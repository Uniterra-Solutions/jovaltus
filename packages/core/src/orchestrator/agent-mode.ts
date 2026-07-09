import type { Agent } from '@earendil-works/pi-agent-core';

import type { JovaltusConfig } from '../config/types.js';
import { createAgent } from '../agent/factory.js';
import type { CreateAgentOptions } from '../agent/types.js';
import { promptWithValidation } from '../agent/output-validation.js';
import { READ_ONLY_TOOLS, READ_WRITE_TOOLS, VERIFY_TOOLS } from '../agent/tools/index.js';
import { CleanDiffManager } from '../diff/manager.js';
import { execGit } from '../git.js';
import { CheckPlanSchema } from './check-plan-schema.js';
import type {
  AgentModeEvent,
  AgentModeOptions,
  AgentModeResult,
  CheckPlan,
  PhaseName,
  PhaseResult,
  VerificationItem,
} from './types.js';

// ── System prompts ─────────────────────────────────────────────────────

const IMPL_PROMPT = `You are a software implementation agent. Your task is to make code changes based on the user's description.
- Use the read tool to understand the existing code first
- Use write/edit to make changes
- Use bash to run tests and verify your changes work
- Make minimal, focused changes — don't refactor unrelated code
- After making changes, verify them with available tests`;

const PLANNER_PROMPT = `You are a planning agent. You will receive the full context of an implementation agent's work session.
Your job is to:
1. Extract and summarize the original task
2. Extract the implementation approach taken
3. Derive acceptance criteria from the task
4. Identify affected modules by searching the codebase
5. Produce a check plan with specific verification commands

Respond with valid JSON only, following the format specified in the system prompt. Do not include markdown code blocks (no \`\`\`json fences) or explanatory text — output only the JSON object.`;

const VERIFIER_PROMPT = `You are a verification agent. You will receive a check plan with verification items.
Your job is to:
1. Execute each verification command using bash
2. Judge whether the output indicates pass or fail
3. Report results using [PASS] or [FAIL] prefix for each item
4. Do NOT modify code — your job is only to evaluate and report`;

const FIXER_PROMPT = `You are a code fixer agent. You will receive a failure diagnostic from the verifier.
Your job is to:
1. Understand what went wrong based on the diagnostic
2. Use the read tool to examine the relevant code
3. Use write/edit to fix the issue
4. Use bash to verify your fix works
5. Make minimal changes — only fix what's broken, don't change unrelated code`;

const SIMPLIFIER_PROMPT = `You are a code simplification agent. You will receive a clean diff showing the net changes of an implementation.
Your job is to simplify the code without changing its behavior:
- Remove redundant or dead code
- Merge duplicate logic
- Extract shared utilities where appropriate
- Improve readability without changing semantics

After simplifying, run the existing tests to confirm nothing is broken.`;

const MAX_FIX_RETRIES = 3;

// ── Shared helpers ─────────────────────────────────────────────────────

/** Extract concatenated text from pi-ai ContentBlock[] or string. */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const texts: string[] = [];
  for (const block of content) {
    const b = block as { type?: string; text?: string };
    if (b.type === 'text' && b.text) texts.push(b.text);
  }
  return texts.join('\n');
}

/** Get the concatenated text of the last assistant message in the transcript. */
function lastAssistantText(messages: readonly unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; content?: unknown };
    if (msg.role === 'assistant') {
      const text = extractText(msg.content);
      if (text) return text;
    }
  }
  return '';
}

/** Format an error from any thrown value. */
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Orchestrator ───────────────────────────────────────────────────────

export class AgentModeOrchestrator {
  private readonly repoPath: string;
  private readonly config: JovaltusConfig;
  private readonly prompts: {
    readonly impl: string;
    readonly planner: string;
    readonly verifier: string;
    readonly fixer: string;
    readonly simplifier: string;
  };
  private readonly listeners = new Set<(e: AgentModeEvent) => void>();

  public constructor(options: AgentModeOptions) {
    this.repoPath = options.repoPath;
    this.config = options.config;
    this.prompts = {
      impl: options.implSystemPrompt ?? IMPL_PROMPT,
      planner: options.plannerSystemPrompt ?? PLANNER_PROMPT,
      verifier: options.verifierSystemPrompt ?? VERIFIER_PROMPT,
      fixer: options.fixerSystemPrompt ?? FIXER_PROMPT,
      simplifier: options.simplifierSystemPrompt ?? SIMPLIFIER_PROMPT,
    };
  }

  // ── Public API ───────────────────────────────────────────────────────

  public onEvent(callback: (e: AgentModeEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public async run(task: string, signal?: AbortSignal): Promise<AgentModeResult> {
    const phases: PhaseResult[] = [];

    const r1 = await this.impl(task, signal);
    phases.push(r1);
    if (r1.status === 'failed') return this.finish(phases);

    const r2 = await this.plan(r1, signal);
    phases.push(r2);
    if (r2.status === 'failed') return this.finish(phases);

    phases.push(await this.verify(r2, signal));
    phases.push(await this.simplify(signal));

    // Re-verify after simplification to confirm no breakage
    const checkPlan = (r2.data as { checkPlan?: CheckPlan } | undefined)?.checkPlan;
    if (checkPlan?.verificationItems.length) {
      phases.push(await this.reverify(checkPlan.verificationItems, signal));
    }

    return this.finish(phases);
  }

  // ── Phase 1: Implementation ──────────────────────────────────────────

  private async impl(task: string, signal?: AbortSignal): Promise<PhaseResult> {
    const phase: PhaseName = 'implementation';
    this.emit({ type: 'phase_start', phase });
    try {
      const startCommit = await this.commit();
      const result = await this.runAgent(
        phase,
        task,
        {
          role: 'worker',
          systemPrompt: this.prompts.impl,
          tools: READ_WRITE_TOOLS,
        },
        undefined,
        signal,
      );
      if (result.error)
        return this.fail(phase, `Implementation error: ${result.error}`, { startCommit });

      await this.commitAll('jovaltus: agent mode implementation');
      return this.ok(phase, 'Implementation completed', {
        startCommit,
        transcript: {
          systemPrompt: result.agent.state.systemPrompt,
          messages: [...result.agent.state.messages],
        },
      });
    } catch (e: unknown) {
      return this.fail(phase, `Phase failed: ${errMsg(e)}`, undefined, e);
    }
  }

  // ── Phase 2: Distill & Plan ──────────────────────────────────────────

  private async plan(implResult: PhaseResult, signal?: AbortSignal): Promise<PhaseResult> {
    const phase: PhaseName = 'planning';
    this.emit({ type: 'phase_start', phase });
    try {
      const data = implResult.data as
        { transcript?: { systemPrompt: string; messages: unknown[] } } | undefined;
      if (!data?.transcript) return this.fail(phase, 'No implementation transcript available');

      const planner = createAgent(
        {
          role: 'coordinator',
          systemPrompt: this.prompts.planner,
          tools: READ_ONLY_TOOLS,
          outputSchema: CheckPlanSchema,
        },
        this.config,
      );

      const unsub = this.subscribeToAgent(planner, phase);
      const abortHandler = (): void => {
        planner.abort();
      };
      signal?.addEventListener('abort', abortHandler);

      let checkPlan: CheckPlan;
      try {
        const prompt = this.buildPlannerPrompt(data.transcript);
        const result = await promptWithValidation(planner, prompt, CheckPlanSchema, 3);

        if (!result.ok) {
          return this.fail(phase, `Planner output validation failed: ${result.errors.join('; ')}`, {
            validationErrors: result.errors,
            rawText: result.rawText,
          });
        }

        checkPlan = result.data;
      } finally {
        signal?.removeEventListener('abort', abortHandler);
        unsub();
      }

      const n = checkPlan.verificationItems.length;
      return this.ok(phase, `Check plan: ${String(n)} verification item${n !== 1 ? 's' : ''}`, {
        checkPlan,
      });
    } catch (e: unknown) {
      return this.fail(phase, `Phase failed: ${errMsg(e)}`, undefined, e);
    }
  }

  // ── Phase 3: Verify & Fix ────────────────────────────────────────────

  private async verify(planResult: PhaseResult, signal?: AbortSignal): Promise<PhaseResult> {
    const phase: PhaseName = 'verification';
    this.emit({ type: 'phase_start', phase });
    try {
      const data = planResult.data as { checkPlan?: CheckPlan } | undefined;
      const items = data?.checkPlan?.verificationItems ?? [];
      if (items.length === 0) return this.ok(phase, 'No verification items to run');

      const verifier = createAgent(
        { role: 'coordinator', systemPrompt: this.prompts.verifier, tools: VERIFY_TOOLS },
        this.config,
      );
      const fixer = createAgent(
        { role: 'worker', systemPrompt: this.prompts.fixer, tools: READ_WRITE_TOOLS },
        this.config,
      );

      const allPassed = await this.verifyLoop(items, verifier, fixer, signal);
      await this.commitAll('jovaltus: agent mode verification fixes');

      return allPassed
        ? this.ok(phase, 'All verification items passed')
        : this.fail(phase, 'Verification items failed after max retries');
    } catch (e: unknown) {
      return this.fail(phase, `Phase failed: ${errMsg(e)}`, undefined, e);
    }
  }

  /** Re-run verification after simplification — no auto-commit, fresh agents. */
  private async reverify(
    items: readonly VerificationItem[],
    signal?: AbortSignal,
  ): Promise<PhaseResult> {
    const phase: PhaseName = 'verification';
    this.emit({ type: 'phase_start', phase });
    try {
      const verifier = createAgent(
        { role: 'coordinator', systemPrompt: this.prompts.verifier, tools: VERIFY_TOOLS },
        this.config,
      );
      const fixer = createAgent(
        { role: 'worker', systemPrompt: this.prompts.fixer, tools: READ_WRITE_TOOLS },
        this.config,
      );

      const allPassed = await this.verifyLoop(items, verifier, fixer, signal);
      return allPassed
        ? this.ok(phase, 'Post-simplification verification passed')
        : this.fail(phase, 'Post-simplification verification failed');
    } catch (e: unknown) {
      return this.fail(phase, `Phase failed: ${errMsg(e)}`, undefined, e);
    }
  }

  private async verifyLoop(
    items: readonly VerificationItem[],
    verifier: Agent,
    fixer: Agent,
    signal?: AbortSignal,
  ): Promise<boolean> {
    let pending = [...items];

    for (let attempt = 0; attempt <= MAX_FIX_RETRIES; attempt++) {
      await this.runAgent(
        'verification',
        this.buildVerifyPrompt(pending),
        undefined,
        verifier,
        signal,
      );
      const parsed = this.parseResults(lastAssistantText(verifier.state.messages));

      if (parsed.length === 0) return false;
      // Match results back to pending items to recover commands
      const results = parsed.map((r) => {
        const match = pending.find((i) => i.description === r.description);
        return { ...r, command: match?.command ?? r.command };
      });
      const failures = results.filter((r) => !r.passed);
      if (failures.length === 0) return true;
      if (attempt >= MAX_FIX_RETRIES) return false;

      this.emit({
        type: 'stream_delta',
        phase: 'verification',
        text: `\n[Fix attempt ${String(attempt + 1)}/${String(MAX_FIX_RETRIES)}] ${String(failures.length)} item(s) failed\n`,
      });

      await this.runAgent('verification', this.buildFixPrompt(failures), undefined, fixer, signal);
      pending = failures.map((f) => ({ description: f.description, command: f.command }));
    }
    return false;
  }

  // ── Phase 4: Simplifier ──────────────────────────────────────────────

  private async simplify(signal?: AbortSignal): Promise<PhaseResult> {
    const phase: PhaseName = 'simplification';
    this.emit({ type: 'phase_start', phase });
    try {
      const endCommit = await this.commit();
      const diffManager = new CleanDiffManager(this.repoPath);

      const log = await execGit(
        ['log', '--format=%H', '--grep=^jovaltus: agent mode implementation$', '-1'],
        this.repoPath,
      );
      const implCommit = log.stdout.trim();
      if (!implCommit) return this.fail(phase, 'Could not find implementation commit');

      const parent = await execGit(['rev-parse', `${implCommit}^`], this.repoPath);
      const diff = await diffManager.compute({ startCommit: parent.stdout.trim(), endCommit });
      if (diff.files.length === 0) return this.ok(phase, 'No changes to simplify');

      const result = await this.runAgent(
        phase,
        this.buildSimplifierPrompt(diff.rawDiff),
        {
          role: 'worker',
          systemPrompt: this.prompts.simplifier,
          tools: READ_WRITE_TOOLS,
        },
        undefined,
        signal,
      );

      if (result.error) return this.fail(phase, `Simplifier error: ${result.error}`);

      const files = diff.files.map((f) => f.filePath);
      return this.ok(phase, `Simplified ${String(files.length)} files`, { files });
    } catch (e: unknown) {
      return this.fail(phase, `Phase failed: ${errMsg(e)}`, undefined, e);
    }
  }

  // ── Core agent runner ─────────────────────────────────────────────────

  /** Create + subscribe + prompt + idle → { agent, error }. Pass existingAgent to skip creation. */
  private async runAgent(
    phase: PhaseName,
    prompt: string,
    createOpts?: CreateAgentOptions,
    existingAgent?: Agent,
    signal?: AbortSignal,
  ): Promise<{ agent: Agent; error: string | undefined }> {
    const agent =
      existingAgent ??
      (createOpts
        ? createAgent(createOpts, this.config)
        : createAgent({ role: 'worker', systemPrompt: '', tools: READ_ONLY_TOOLS }, this.config));
    const unsub = this.subscribeToAgent(agent, phase);
    const abortHandler = (): void => {
      agent.abort();
    };
    signal?.addEventListener('abort', abortHandler);
    try {
      await agent.prompt(prompt);
      await agent.waitForIdle();
    } finally {
      signal?.removeEventListener('abort', abortHandler);
      unsub();
    }
    return { agent, error: agent.state.errorMessage };
  }

  // ── Event subscription ───────────────────────────────────────────────

  private subscribeToAgent(agent: Agent, phase: PhaseName): () => void {
    return agent.subscribe((event) => {
      switch (event.type) {
        case 'agent_start':
        case 'agent_end':
        case 'turn_start':
        case 'turn_end':
        case 'message_start':
        case 'message_end':
        case 'tool_execution_update':
          break;
        case 'message_update': {
          const evt = event.assistantMessageEvent as { type?: string; text?: string };
          if (evt.type === 'text_delta' && evt.text)
            this.emit({ type: 'stream_delta', phase, text: evt.text });
          break;
        }
        case 'tool_execution_start':
          this.emit({
            type: 'tool_call',
            phase,
            toolName: event.toolName,
            args: event.args as unknown,
          });
          break;
        case 'tool_execution_end':
          this.emit({
            type: 'tool_result',
            phase,
            toolName: event.toolName,
            isError: event.isError,
          });
          break;
      }
    });
  }

  // ── Parsing ──────────────────────────────────────────────────────────

  private parseResults(
    text: string,
  ): readonly { description: string; command: string; passed: boolean; output?: string }[] {
    const results: { description: string; command: string; passed: boolean; output?: string }[] =
      [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (raw === undefined) continue;
      const line = raw.trim();
      const pass = /^\[PASS\]\s+(.+)/i.exec(line);
      const fail = /^\[FAIL\]\s+(.+)/i.exec(line);
      if (pass?.[1]) {
        results.push({ description: pass[1].trim(), command: '', passed: true });
      } else if (fail?.[1]) {
        // Capture subsequent lines as output until next [PASS]/[FAIL] or end
        const outLines: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
          const next = lines[j];
          if (next === undefined || /^\[(?:PASS|FAIL)\]/.test(next.trim())) break;
          outLines.push(next);
          j++;
        }
        results.push({
          description: fail[1].trim(),
          command: '',
          passed: false,
          output: outLines.join('\n').trim() || undefined,
        });
      }
    }
    return results;
  }

  // ── Prompt builders ──────────────────────────────────────────────────

  private buildPlannerPrompt(t: { systemPrompt: string; messages: unknown[] }): string {
    const parts: string[] = [
      '## Implementation Session',
      `### System Prompt\n\`\`\`\n${t.systemPrompt}\n\`\`\``,
    ];
    for (const msg of t.messages as Array<{ role?: string; content?: unknown }>) {
      const role = msg.role;
      if (role === 'user' || role === 'assistant') {
        const text = extractText(msg.content);
        if (text) parts.push(`### ${role}\n${text}`);
      }
    }
    parts.push(
      '\n---\nAnalyze the above session and produce a check plan following your output format.',
    );
    return parts.join('\n\n');
  }

  private buildVerifyPrompt(items: readonly VerificationItem[]): string {
    const lines = [
      'Run each verification command below using bash. Report using [PASS] or [FAIL] prefix.',
      'For failures, include the error output.\n---\n',
    ];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item)
        lines.push(
          `**Item ${String(i + 1)}**: ${item.description}\nCommand: \`${item.command}\`\n`,
        );
    }
    return lines.join('\n');
  }

  private buildFixPrompt(
    failures: readonly { description: string; command: string; output?: string }[],
  ): string {
    const lines = ['The following verification items failed. Fix the issues:\n'];
    for (const f of failures) {
      lines.push(`### ${f.description}\nCommand: \`${f.command}\``);
      if (f.output) lines.push(`Output:\n\`\`\`\n${f.output}\n\`\`\``);
      lines.push('');
    }
    lines.push('Make minimal fixes, then run the commands to verify.');
    return lines.join('\n');
  }

  private buildSimplifierPrompt(diff: string): string {
    return `## Clean Diff (implementation start → verification complete)

\`\`\`diff
${diff}
\`\`\`

---

Simplify the above changes. Run existing tests to confirm nothing is broken.`;
  }

  // ── Event / result helpers ───────────────────────────────────────────

  private emit(e: AgentModeEvent): void {
    for (const l of this.listeners) {
      try {
        l(e);
      } catch {
        /* swallow */
      }
    }
  }

  private ok(phase: PhaseName, summary: string, data?: unknown): PhaseResult {
    const r: PhaseResult = { phase, status: 'completed', summary, data };
    this.emit({ type: 'phase_end', phase, result: r });
    return r;
  }

  private fail(phase: PhaseName, summary: string, data?: unknown, err?: unknown): PhaseResult {
    if (err) this.emit({ type: 'error', phase, message: errMsg(err) });
    const r: PhaseResult = { phase, status: 'failed', summary, data };
    this.emit({ type: 'phase_end', phase, result: r });
    return r;
  }

  private async commit(): Promise<string> {
    const r = await execGit(['rev-parse', 'HEAD'], this.repoPath);
    return r.stdout.trim();
  }

  private async commitAll(msg: string): Promise<void> {
    await execGit(['add', '-A'], this.repoPath);
    await execGit(['commit', '-m', msg], this.repoPath);
  }

  private buildSummary(phases: readonly PhaseResult[]): string {
    let passed = 0;
    const lines = ['# Agent Mode Summary'];
    for (const p of phases) {
      lines.push(`${p.status === 'completed' ? '✅' : '❌'} **${p.phase}**: ${p.summary}`);
      if (p.status === 'completed') passed++;
    }
    lines.push(`\n**${String(passed)}/${String(phases.length)} phases passed**`);
    const failed = phases.length - passed;
    if (failed) lines.push(`${String(failed)} phase(s) failed.`);
    return lines.join('\n');
  }

  private finish(phases: PhaseResult[]): AgentModeResult {
    const last = phases[phases.length - 1];
    const files = (last?.data as { files?: string[] } | undefined)?.files ?? [];
    return { phases, simplifiedFiles: files, finalSummary: this.buildSummary(phases) };
  }
}
