# Agent Runtime Foundation fix plan

- `docs/plans/2026-06-21/agent-runtime-foundation/` - Spec context
- `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md` - Verification checklist
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md` - Current review report

## ROLE

You are the fix coordinator for the current Agent Runtime Foundation review findings.

Coordinate focused workers to resolve the two P1 findings in `REPORT.md`, add regression coverage for both defects, and verify that the implementation satisfies Req 2, Req 3, and Req 4 without broadening scope beyond the core runtime foundation.

The coordinator supervises execution, checks batch gates, and resolves integration conflicts. Workers perform source fixes and test edits using the prompts under `fix/`.

## RULES

Always:
- Follow the batch order in this plan.
- Keep source edits scoped to `packages/core/src/tools/workspace.ts`, `packages/core/src/tools/bash-tool.ts`, and directly related tests.
- Preserve all existing public interfaces unless a type-preserving internal validation helper is needed.
- Preserve structured `ToolResult` failures; do not let tool handlers throw for expected bad inputs.
- Add regression tests that fail on the reviewed implementation and pass after the corresponding fix.
- Run the verification gate after each batch before moving forward.

Ask first:
- Before adding dependencies or changing package manager files.
- Before touching `apps/extension/`, agent loop orchestration, MCP execution, external memory persistence, permission UI, or unrelated docs.
- Before changing public tool ids, names, result shapes, or registry APIs.

Never:
- Use destructive git commands.
- Revert unrelated user changes.
- Weaken or delete existing tests to make a gate pass.
- Run parallel workers that modify overlapping files.

## WORKING STEPS

### 1. PREPARATION

Read these files before dispatching workers:

- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md` - authoritative issue list: P1-001 workspace path false rejection and P1-002 bash timeout validation.
- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` - expected behavior for Req 2, Req 3, Req 4, and structured validation outcomes.
- `docs/plans/2026-06-21/agent-runtime-foundation/DESIGN.md` - design invariants for workspace file tools, bash execution, and structured failures.
- `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md` - final verification expectations.
- `packages/core/src/tools/workspace.ts` - source for P1-001.
- `packages/core/src/tools/bash-tool.ts` - source for P1-002.
- `packages/core/src/tools/registry.test.ts` - current integration-style tests for file and bash tools.
- `fix/FIX-01-workspace-dotdot-prefix.md` - source-fix worker prompt for P1-001.
- `fix/FIX-02-bash-timeout-validation.md` - source-fix worker prompt for P1-002.
- `fix/REGTEST-01-workspace-dotdot-prefix.md` - regression-test worker prompt for P1-001.
- `fix/REGTEST-02-bash-timeout-validation.md` - regression-test worker prompt for P1-002.

### 2. COORDINATION

Batch 1: source fixes.

- Dispatch `fix/FIX-01-workspace-dotdot-prefix.md` and `fix/FIX-02-bash-timeout-validation.md` in parallel only if the coordinator can guarantee file isolation.
- `FIX-01` may modify `packages/core/src/tools/workspace.ts`.
- `FIX-02` may modify `packages/core/src/tools/bash-tool.ts`.
- Gate after both workers complete:
  - `pnpm typecheck`
  - `pnpm test -- --run packages/core/src/tools/registry.test.ts`

Batch 2: regression test for P1-001.

- Dispatch `fix/REGTEST-01-workspace-dotdot-prefix.md`.
- This worker modifies `packages/core/src/tools/registry.test.ts`.
- Gate:
  - Confirm the new test would fail on the unfixed `workspace.ts` implementation.
  - `pnpm test -- --run packages/core/src/tools/registry.test.ts`

Batch 3: regression test for P1-002.

- Dispatch `fix/REGTEST-02-bash-timeout-validation.md`.
- This worker also modifies `packages/core/src/tools/registry.test.ts`, so it must run after Batch 2.
- Gate:
  - Confirm the new test would fail on the unfixed `bash-tool.ts` implementation.
  - `pnpm test -- --run packages/core/src/tools/registry.test.ts`

Batch 4: integration cleanup.

- Inspect all changes for consistency with `REPORT.md`, `SPEC.md`, and existing code style.
- Resolve any non-overlapping test import or formatting issues created by the sequential test workers.
- Gate:
  - `pnpm typecheck`
  - `pnpm test -- --run`

### 3. FINAL VERIFICATION

Run all final gates:

```sh
pnpm test -- --run
pnpm typecheck
```

Confirm:
- P1-001 is resolved: valid in-workspace paths whose first relative segment begins with `..` but is not the parent segment are accepted by file tools.
- Existing outside-workspace rejection behavior still holds for `../outside.txt` and absolute paths outside the workspace.
- Existing read-before-write behavior still rejects unread existing in-workspace files.
- P1-002 is resolved: invalid `timeoutMs` values return a structured tool error from the bash tool instead of `UNKNOWN_ERROR`.
- Valid bash commands still run with `context.workspaceRoot` as cwd.
- No unrelated files were modified and no new dependencies were added.

## Fix History

### Previous Fix Plan - 2026-06-22

The previous `FIX.md` targeted an older review state: outside-workspace access, optional context provider rejection, and lint cleanup. That plan is superseded because the current `REPORT.md` lists two different P1 findings: false rejection of valid `..`-prefixed in-workspace path segments and missing bash timeout validation.
