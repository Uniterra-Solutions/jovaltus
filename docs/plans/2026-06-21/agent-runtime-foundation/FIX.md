# Agent Runtime Foundation fix plan

- `docs/plans/2026-06-21/agent-runtime-foundation/` - Spec context
- `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md` - Verification checklist
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md` - Current review report

## ROLE

You are the fix coordinator for the current Agent Runtime Foundation review finding.

Coordinate focused workers to resolve `P2-001` from `REPORT.md`: workspace file tools currently validate containment against the lexical requested path before filesystem access, while Node file operations follow symlinks. The goal is to preserve Req 2 and Req 3 behavior for normal in-workspace paths while preventing symlink paths inside the workspace from reaching content outside the workspace boundary.

The coordinator supervises execution, checks batch gates, and resolves integration conflicts. Workers perform source fixes and test edits using the prompts under `fix/`.

## RULES

Always:
- Follow the batch order in this plan.
- Keep source edits scoped to workspace path resolution and directly related tool tests.
- Preserve all public tool ids, names, parameter schemas, result shapes, and registry APIs.
- Preserve structured `ToolResult` failures; expected path-boundary failures must return `INVALID_PARAMS`, not thrown exceptions.
- Keep existing valid behavior intact: normal relative paths, absolute paths inside the workspace, `..foo` path segments, new file creation, read-before-write enforcement, and outside `../` rejection.
- Add regression tests that fail on the reviewed implementation and pass after the corresponding fix.
- Run the verification gate after each batch before moving forward.

Ask first:
- Before adding dependencies or changing package manager files.
- Before touching `apps/extension/`, context composer code, bash behavior, agent loop orchestration, MCP execution, external memory persistence, permission UI, or unrelated docs.
- Before changing the documented behavior for symlinks that resolve to a target still inside the workspace.
- Before changing public TypeScript interfaces.

Never:
- Use destructive git commands.
- Revert unrelated user changes.
- Weaken, skip, or delete existing tests to make a gate pass.
- Run parallel workers that modify overlapping files.

## WORKING STEPS

### 1. PREPARATION

Read these files before dispatching workers:

- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md` - authoritative current issue list: `P2-001` symlink workspace-boundary risk.
- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` - expected behavior for Req 2, Req 3, structured validation outcomes, and workspace data boundary.
- `docs/plans/2026-06-21/agent-runtime-foundation/DESIGN.md` - design invariants for workspace file tools and read-before-write state.
- `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md` - final verification expectations, especially CL-03, CL-04, CL-05, and hardening checks.
- `docs/plans/2026-06-21/agent-runtime-foundation/references/node-runtime-apis.md` - Node file API context and no-new-dependency constraint.
- `packages/core/src/tools/workspace.ts` - current lexical workspace containment helper and primary source-fix target.
- `packages/core/src/tools/read-tool.ts` - caller that marks read state from the resolved target path.
- `packages/core/src/tools/write-tool.ts` - caller that checks existence, read state, and writes to the resolved target path.
- `packages/core/src/tools/edit-tool.ts` - caller that checks read state and edits the resolved target path.
- `packages/core/src/tools/registry.test.ts` - existing integration-style tests for file tools and regression-test target.
- `fix/FIX-01-symlink-workspace-boundary.md` - source-fix worker prompt for `P2-001`.
- `fix/REGTEST-01-symlink-workspace-boundary.md` - regression-test worker prompt for `P2-001`.

### 2. COORDINATION

Batch 1: source fix for `P2-001`.

- Dispatch `fix/FIX-01-symlink-workspace-boundary.md`.
- This worker may modify `packages/core/src/tools/workspace.ts` and, only if necessary to preserve the existing tool contract, minimal call sites in `packages/core/src/tools/read-tool.ts`, `packages/core/src/tools/write-tool.ts`, and `packages/core/src/tools/edit-tool.ts`.
- Gate after the worker completes:
  - `pnpm typecheck`
  - `pnpm test -- --run packages/core/src/tools/registry.test.ts`

Batch 2: regression test for `P2-001`.

- Dispatch `fix/REGTEST-01-symlink-workspace-boundary.md`.
- This worker may modify only `packages/core/src/tools/registry.test.ts`.
- Gate:
  - Confirm the new symlink escape test fails on the unfixed lexical-only implementation.
  - `pnpm test -- --run packages/core/src/tools/registry.test.ts`

Batch 3: integration cleanup.

- Inspect the source and test changes for consistency with `REPORT.md`, `SPEC.md`, and existing code style.
- Confirm no old worker prompts for superseded P1 findings remain active in `fix/`.
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
- `P2-001` is resolved: file tools reject a symlink path inside the workspace when the symlink resolves to a target outside the workspace.
- Failed symlink escape reads do not mark read state for the symlink path or outside target.
- Failed symlink escape writes and edits leave the outside target content unchanged.
- Existing outside-workspace rejection behavior still holds for `../outside.txt` and absolute paths outside the workspace.
- Existing valid in-workspace behavior still holds for normal relative paths, absolute paths inside the workspace, and legitimate `..foo` path segments.
- Existing read-before-write behavior still rejects unread existing in-workspace files and allows previously read existing in-workspace files.
- No unrelated files were modified and no new dependencies were added.

## Fix History

### Current Fix Round — 2026-06-22

- **Finding resolved**: `P2-001` — workspace containment now validates canonical (realpath-resolved) targets, not just lexical paths.
- **Changes**:
  - `packages/core/src/tools/workspace.ts`: `resolveInWorkspace()` made async; uses `fs.realpath` to canonicalize workspace root and target paths. Three-layer defense: (1) lexical fast-path check, (2) realpath check for existing targets, (3) parent-walk realpath check for new targets.
  - `packages/core/src/tools/read-tool.ts`, `write-tool.ts`, `edit-tool.ts`: Updated to `await resolveInWorkspace(...)`.
  - `packages/core/src/tools/registry.test.ts`: Added 3 regression tests (read/write/edit) proving symlink escape is rejected.
- **Verification**: `pnpm test -- --run` 53/53 passed; `pnpm typecheck` passed.

### Previous Fix Plan — 2026-06-22

The previous `FIX.md` targeted an older review state with two P1 findings: false rejection of valid `..`-prefixed in-workspace path segments and missing bash timeout validation. Those defects are now fixed and covered by tests. The current plan supersedes that work and targets the only current review finding, `P2-001`.

### Earlier Fix Plan — 2026-06-22

An earlier plan targeted outside-workspace access, optional context provider rejection, and lint cleanup. That plan was already superseded before the current review round.
