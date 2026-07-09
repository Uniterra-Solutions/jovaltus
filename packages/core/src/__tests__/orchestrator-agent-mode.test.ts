import { describe, it, expect } from 'vitest';
import { AgentModeOrchestrator } from '../orchestrator/agent-mode.js';
import { CheckPlanSchema } from '../orchestrator/check-plan-schema.js';
import { Value } from '@sinclair/typebox/value';
import type {
  PhaseName,
  PhaseResult,
  AgentModeResult,
  AgentModeEvent,
  VerificationItem,
} from '../orchestrator/types.js';
import type { JovaltusConfig } from '../config/types.js';

const testConfig: JovaltusConfig = {
  coordinatorModel: { modelId: 'claude-sonnet-4-5', contextWindow: 200_000, maxTokens: 4096 },
  workerModel: { modelId: 'claude-haiku-4-5', contextWindow: 200_000, maxTokens: 4096 },
  openai: { baseUrl: 'https://api.openai.com/v1', apiKey: 'test-openai-key' },
  anthropic: { baseUrl: 'https://api.anthropic.com', apiKey: 'test-anthropic-key' },
};

/** Call a private method on the orchestrator prototype. */
function callPrivate(method: string, ...args: unknown[]): unknown {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return (
    AgentModeOrchestrator.prototype as unknown as Record<string, (...a: unknown[]) => unknown>
  )[method]!(...args);
}

describe('AgentModeOrchestrator', () => {
  describe('constructor', () => {
    it('creates with default prompts', () => {
      expect(new AgentModeOrchestrator({ repoPath: '/tmp', config: testConfig })).toBeInstanceOf(
        AgentModeOrchestrator,
      );
    });

    it('accepts custom prompts', () => {
      expect(
        new AgentModeOrchestrator({
          repoPath: '/tmp',
          config: testConfig,
          implSystemPrompt: 'I',
          plannerSystemPrompt: 'P',
          simplifierSystemPrompt: 'S',
          verifierSystemPrompt: 'V',
          fixerSystemPrompt: 'F',
        }),
      ).toBeInstanceOf(AgentModeOrchestrator);
    });
  });

  describe('onEvent', () => {
    it('returns unsubscribe function', () => {
      const o = new AgentModeOrchestrator({ repoPath: '/tmp', config: testConfig });
      expect(typeof o.onEvent(() => {})).toBe('function');
    });
  });

  describe('CheckPlanSchema', () => {
    it('validates a complete check plan', () => {
      const valid = {
        taskSummary: 'Added validation to the form.',
        implementationPlan: 'Read form component, added Zod validation, updated tests.',
        acceptanceCriteria: ['All fields validated', 'Error messages user-friendly'],
        affectedModules: ['src/components/RegisterForm.tsx'],
        verificationItems: [
          { description: 'Run unit tests', command: 'npm test -- RegisterForm' },
          { description: 'Type check passes', command: 'npx tsc --noEmit' },
        ],
      };
      expect(Value.Check(CheckPlanSchema, valid)).toBe(true);
    });

    it('rejects missing required fields', () => {
      expect(Value.Check(CheckPlanSchema, {})).toBe(false);
    });

    it('rejects wrong types', () => {
      expect(
        Value.Check(CheckPlanSchema, {
          taskSummary: 123,
          implementationPlan: 'ok',
          acceptanceCriteria: 'not-an-array',
          affectedModules: [],
          verificationItems: [],
        }),
      ).toBe(false);
    });

    it('rejects invalid verification items', () => {
      const invalid = {
        taskSummary: 'Test',
        implementationPlan: 'Plan',
        acceptanceCriteria: [],
        affectedModules: [],
        verificationItems: [
          { description: 'missing command' },
          { notDescription: 'missing description', notCommand: 'missing command' },
        ],
      };
      expect(Value.Check(CheckPlanSchema, invalid)).toBe(false);
    });
  });

  describe('parseResults', () => {
    it('parses [PASS] and [FAIL] lines', () => {
      const r = callPrivate(
        'parseResults',
        '[PASS] Tests ok\n[FAIL] Lint fails\n[PASS] Typecheck ok',
      ) as readonly { passed: boolean; description: string }[];
      expect(r).toHaveLength(3);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(r[0]!.passed).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(r[1]!.passed).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(r[1]!.description).toBe('Lint fails');
    });

    it('captures error output after [FAIL] lines', () => {
      const r = callPrivate(
        'parseResults',
        '[PASS] Tests ok\n[FAIL] Lint fails\n3 errors found\nsrc/foo.ts:1:1\n[PASS] Typecheck ok',
      ) as readonly { passed: boolean; description: string; output?: string }[];
      expect(r).toHaveLength(3);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(r[1]!.passed).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(r[1]!.output).toBe('3 errors found\nsrc/foo.ts:1:1');
    });

    it('handles trailing output after last [FAIL]', () => {
      const r = callPrivate(
        'parseResults',
        '[FAIL] Build broken\nerror TS1234: compilation failed\n',
      ) as readonly { passed: boolean; output?: string }[];
      expect(r).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(r[0]!.output).toBe('error TS1234: compilation failed');
    });

    it('handles no result lines', () => {
      expect(callPrivate('parseResults', 'nothing here')).toHaveLength(0);
    });
  });

  describe('buildVerifyPrompt', () => {
    it('includes all verification items', () => {
      const items: readonly VerificationItem[] = [
        { description: 'Run tests', command: 'npm test' },
        { description: 'Type check', command: 'npx tsc --noEmit' },
      ];
      const r = callPrivate('buildVerifyPrompt', items);
      expect(r).toContain('[PASS]');
      expect(r).toContain('Run tests');
      expect(r).toContain('npx tsc --noEmit');
    });
  });

  describe('buildFixPrompt', () => {
    it('includes failure details', () => {
      const r = callPrivate('buildFixPrompt', [
        { description: 'Lint fails', command: 'npm run lint', output: '3 errors' },
      ]);
      expect(r).toContain('Lint fails');
      expect(r).toContain('3 errors');
    });
  });

  describe('buildSimplifierPrompt', () => {
    it('wraps diff in markdown', () => {
      expect(callPrivate('buildSimplifierPrompt', '+added\n-removed')).toContain(
        '+added\n-removed',
      );
    });
  });

  describe('buildPlannerPrompt', () => {
    it('includes user/assistant messages, excludes toolResult', () => {
      const r = callPrivate('buildPlannerPrompt', {
        systemPrompt: 'You are a coder.',
        messages: [
          { role: 'user', content: 'Fix the bug' },
          { role: 'assistant', content: [{ type: 'text', text: 'Fixed!' }] },
          { role: 'toolResult', content: 'tool output' },
        ],
      });
      expect(r).toContain('Fix the bug');
      expect(r).toContain('Fixed!');
      expect(r).not.toContain('tool output');
    });
  });

  describe('buildSummary', () => {
    it('counts passed/failed', () => {
      const phases: PhaseResult[] = [
        { phase: 'implementation', status: 'completed', summary: 'Done' },
        { phase: 'planning', status: 'completed', summary: 'Ready' },
        { phase: 'verification', status: 'failed', summary: '2 items failed' },
      ];
      const r = callPrivate('buildSummary', phases);
      expect(r).toContain('2/3 phases passed');
      expect(r).toContain('1 phase(s) failed');
    });
  });
});

describe('Orchestrator types', () => {
  it('PhaseName covers 4 phases', () => {
    const p: PhaseName[] = ['implementation', 'planning', 'verification', 'simplification'];
    expect(p).toHaveLength(4);
  });

  it('AgentModeEvent variants compile', () => {
    const e: AgentModeEvent = { type: 'phase_start', phase: 'implementation' };
    expect(e.type).toBe('phase_start');
  });

  it('AgentModeResult is complete', () => {
    const r: AgentModeResult = { phases: [], simplifiedFiles: [], finalSummary: 'done' };
    expect(r.finalSummary).toBe('done');
  });
});
