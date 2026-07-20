---
name: jovaltus-agent
description: >-
  Orchestrates the Jovaltus 4-phase development pipeline for multi-file
  software features: Plan → Implement → Verify & Fix → Simplify. Each phase
  spawns an isolated subagent via delegate_task, loaded with a curated
  system prompt from the prompts/ directory.

  LOAD when:
  - User says "start pipeline", "enter jovaltus mode"
  - User names phases in sequence: "plan this", "implement
    and verify", "run through the pipeline"
  - User asks to "implement [feature]" where it clearly spans
    multiple files / needs reasoning (NOT a single-file fix)

  DO NOT load when:
  - Single-command investigations, typo fixes, or one-line changes
  - Quick code reviews, dependency bumps, pure read-only tasks
  - Phase words (verify/simplify/implement) appear in non-pipeline
    context (e.g., "verify the file exists", "simplify this")
  - Any task completable in under 2 minutes or in a single file

  When in doubt: do NOT load. Confirm with the user before
  committing to a 4-phase run.
author: LaiTszKin
version: 0.6.0
metadata:
  jovaltus:
    tags: [development, pipeline, code-quality, verification, multi-agent]
---

# Jovaltus Pipeline

## Goal

Drive a structured 4-phase development workflow where each phase delegates to a focused subagent.
Each subagent is spawned via `delegate_task` with a curated system prompt from `prompts/*.md`.
The output is a verified, simplified commit produced by the pipeline subagents.

## Core Principles

- **Direct Delegate Pattern.** All phases use `delegate_task` directly — no intermediate tools or state tracking. Read the prompt file, compose context, dispatch.
- **One concern per subagent.** Implement writes code. Verify adversarially tests and fixes. Simplify restructures without behaviour change. No subagent does another's job.
- **Stateless.** No task IDs, no stage machine, no process-local state. Every phase is self-contained. Works across sessions and process restarts.

## Workflow

### Phase 0: Planning — before any subagent

1. **Clarify requirements** with `clarify` (1-3 questions per round: scope, business flow, constraints, value).
2. **Build a checklist** of structured business requirements.
3. **Research** with `web_search` if needed (API docs, package versions, known issues).
4. **Confirm** the checklist with the user.
   - **User accepts** → proceed to Phase 1.
   - **User rejects or requests changes** → loop back to step 1 (re-clarify) or step 2 (amend checklist). Do NOT proceed to Phase 1 until explicit confirmation.
   - **User cancels entirely** → stop. Save any collected context for reference.

### Phase 1: Implement

**Pre-flight:** Check `git status --porcelain`. If the working tree has uncommitted changes, warn the user and suggest stashing or committing before proceeding. Record `git rev-parse HEAD` as the baseline.

Choose the implementation path:

- **Path A (default) — delegate_task** when the change spans multiple files, needs codebase exploration, or involves significant reasoning. Read `prompts/implement.md`, compose a `delegate_task` call with `goal=` set to the implement prompt and `context=` containing the project directory, reference commit, and the Phase 0 plan checklist. The subagent auto-commits.

- **Path B — Implement directly** when the change is well-scoped, self-contained, mechanical, and you already hold full context. Skip the subagent but still satisfy the verification checks (tests, lint, type-check, edge-case review) before moving on.

### Phase 2: Verify & Fix

Read `prompts/verify.md`. Compute the diff: `git diff <baseline>..HEAD`. Compose a `delegate_task` call:
- `goal=` → the verify prompt (read from `prompts/verify.md`)
- `context=` → working directory, diff range, files changed, the full git diff
- `toolsets=["terminal", "file", "computer_use"]`

The verification subagent runs tests adversarially, reviews the diff for bugs, fixes everything found, and re-verifies until clean. It has write access and commits when done.

### Phase 3: Simplify

Read `prompts/simplify.md`. Compute the diff: `git diff <baseline>..HEAD`. Compose a `delegate_task` call:
- `goal=` → the simplify prompt (read from `prompts/simplify.md`)
- `context=` → working directory, diff range, files changed, the full git diff
- `toolsets=["terminal", "file"]`

The simplifier subagent applies structural improvements without behaviour change: extract repeated code, delete dead code (grep-backed), flatten nesting, improve naming. After simplification, run `pytest` (or the project's test framework) to confirm behaviour is preserved. Subagent commits when done.

### Afterwards

Present the final result: what was implemented, what issues were found and fixed during verification, what was simplified, any notable decisions. Ask if the user wants to start a new task or adjust.

## Gotchas

- **Dirty working tree corrupts the verification diff.** Always record `git rev-parse HEAD` as the baseline BEFORE starting Phase 1. If the working tree has uncommitted changes, those are included in the diff — the verification subagent will inspect and potentially "fix" code it didn't write. Always check `git status --porcelain` before starting Phase 1.
- **Subagent crash mid-phase leaves partial changes.** If a subagent fails mid-flight, the working tree may contain incomplete edits. The pipeline does NOT auto-rollback. Manually run `git checkout -- .` or `git reset --hard HEAD` to discard partial changes before retrying. Verify with `git status` after cleanup.
- **Verify fix loop has no iteration cap.** The verification subagent retries until all checks pass. If a bug is genuinely unfixable (broken test fixture, upstream API change), the loop may diverge. If you see more than 3-4 retry cycles, intervene manually.
- **Context size matters.** Each `delegate_task` call sends the full diff as context. For large changes (>500 lines), consider splitting into smaller batches or summarizing the diff.

## References

- `prompts/implement.md` — Implement subagent system prompt
- `prompts/verify.md` — Verification subagent system prompt (includes adversarial checklist)
- `prompts/simplify.md` — Simplifier subagent system prompt (includes simplification checklist)
- Hermes tool: `delegate_task` — spawns isolated subagents with terminal + file access
