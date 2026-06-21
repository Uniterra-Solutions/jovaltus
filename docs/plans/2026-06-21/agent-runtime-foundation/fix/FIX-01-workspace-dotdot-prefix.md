# Fix Worker Prompt: FIX-01-workspace-dotdot-prefix

- **Related issue**: P1-001 - valid in-workspace paths with `..`-prefixed segment names are rejected

---

## 1. Mission & Rules

### Mission

Fix workspace containment so file tools accept valid in-workspace paths like `..foo/file.txt` while continuing to reject real parent traversal outside the workspace.

### Context

The review flagged a spec implementation deviation for Req 2 and Req 3. `resolveInWorkspace()` currently treats any relative path beginning with `..` as outside the workspace, including legal path segments whose names merely start with two dots.

### Rules

- Follow the Scope in Section 5.
- Preserve existing read-before-write semantics.
- Preserve rejection of actual outside-workspace paths such as `../outside.txt` and absolute paths outside the workspace.
- Do not change public tool ids, names, registry APIs, or result shapes.
- Do not add dependencies.
- Workers are leaf nodes - do not spawn sub-workers.

---

## 2. Context

### Input Files

- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` - Req 2 and Req 3 expected workspace file behavior.
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md` - P1-001 issue details.
- `packages/core/src/tools/workspace.ts` - function to fix.
- `packages/core/src/tools/read-tool.ts` - caller that depends on `resolveInWorkspace()`.
- `packages/core/src/tools/write-tool.ts` - caller that depends on `resolveInWorkspace()`.
- `packages/core/src/tools/edit-tool.ts` - caller that depends on `resolveInWorkspace()`.
- `packages/core/src/tools/registry.test.ts` - integration-style tests to keep passing.

### Root Cause

`packages/core/src/tools/workspace.ts` computes `relative(workspaceRoot, resolved)` and rejects when `rel.startsWith('..')`. That check confuses a legitimate first path segment such as `..foo` with the parent-directory segment `..`.

---

## 3. Tasks

### `packages/core/src/tools/workspace.ts` - fix containment predicate

1. Open `packages/core/src/tools/workspace.ts`.
2. Locate `resolveInWorkspace()` lines 32-50.
3. Replace the broad `rel.startsWith('..')` check with a boundary-aware predicate:
   - Reject when `rel === '..'`.
   - Reject when `rel.startsWith('../')`.
   - Reject platform-specific separator variants if needed by using `sep` from `node:path` or an equivalent robust check.
   - Reject absolute `rel` values if `relative()` can produce one for different roots on the current platform.
4. Update the nearby comment so it describes rejecting the parent segment, not every `..` prefix.
5. Do not modify callers unless the changed helper requires an import adjustment.

### Output

When done, report back to the coordinator:
- **Files modified**: expected `packages/core/src/tools/workspace.ts`
- **Change summary**: describe the corrected boundary-aware containment check
- **Test results**: command outputs and pass/fail
- **Risks or concerns**: any platform path behavior not covered by tests

---

## 4. Verification

1. Run: `pnpm typecheck`
   - Expected: passes.
2. Run: `pnpm test -- --run packages/core/src/tools/registry.test.ts`
   - Expected: passes.

---

## 5. Scope & References

### Allowed Files

- `packages/core/src/tools/workspace.ts` - required source fix.

### Forbidden Files

- `packages/core/src/tools/registry.test.ts` - owned by regression-test workers.
- `packages/core/src/tools/bash-tool.ts` - owned by `FIX-02`.
- `apps/extension/**` - out of scope.
- Package manager files - no dependency changes are needed.

### Related Documents

- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/FIX.md`
