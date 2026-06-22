# Regression Test Worker Prompt: REGTEST-01-symlink-workspace-boundary

- **Related fix**: FIX-01 - Symlink workspace-boundary hardening

---

## 1. Mission & Rules

### Mission

Add regression coverage proving file tools reject symlink paths inside the workspace when those symlinks resolve to targets outside the workspace.

### Context

The source fix for `P2-001` hardens workspace path resolution against symlink escapes. The regression tests must prove that read, write, and edit tools do not access outside-workspace content through an in-workspace symlink path, while existing valid path behaviors remain covered by the current test file.

### Rules

- Only create or modify test files - never modify source code.
- The symlink escape test must fail on the unfixed lexical-only implementation and pass after the fix is applied.
- Follow the existing test patterns and style in `packages/core/src/tools/registry.test.ts`.
- Keep tests deterministic with temp directories and local filesystem operations.
- If symlink creation is unavailable on the current platform, report to the coordinator instead of weakening the oracle.
- Workers are leaf nodes - do not spawn sub-workers.

---

## 2. Context

### Input Files

- `packages/core/src/tools/registry.test.ts` - write the regression tests here and follow existing setup patterns.
- `packages/core/src/tools/workspace.ts` - understand the fixed boundary behavior.
- `packages/core/src/tools/read-tool.ts` - understand read-state side effects to assert after failed reads.
- `packages/core/src/tools/write-tool.ts` - understand write behavior and outside target preservation.
- `packages/core/src/tools/edit-tool.ts` - understand edit behavior and outside target preservation.
- `docs/plans/2026-06-21/agent-runtime-foundation/fix/FIX-01-symlink-workspace-boundary.md` - source-fix context.
- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` - Req 2, Req 3, and structured validation expectations.

### Test Design

- **Test ID**: REGTEST-01
- **Type**: Integration-style unit tests with temp filesystem.
- **Location**: `packages/core/src/tools/registry.test.ts`
- **Scenario**: GIVEN an in-workspace symlink points to a directory outside the workspace WHEN read, write, or edit tools are invoked through that symlink path THEN the tool returns `INVALID_PARAMS` and outside content is not read, written, edited, or marked as read.
- **Oracle**: On the unfixed lexical-only implementation, `file_read` through the symlink succeeds and returns outside content; after the fix, it fails with `INVALID_PARAMS`. Write/edit assertions should likewise fail on the unfixed implementation if a symlink path is used to reach outside content.

---

## 3. Tasks

1. Open `packages/core/src/tools/registry.test.ts`.
2. Update imports if needed:
   - The file already imports `mkdtempSync` and `writeFileSync` from `node:fs`.
   - Add `symlink` and `readFile` from `node:fs/promises` if needed, preserving existing imports.
3. In the `Read tool` describe block, add a test after the outside absolute path tests:
   - Create a temp workspace using `setup()`.
   - Create an outside temp directory with `mkdtempSync(join(tmpdir(), 'jovaltus-outside-'))`.
   - Write `secret.txt` in the outside directory with content like `outside secret`.
   - Create an in-workspace symlink, for example `await symlink(outsideRoot, join(root, 'outside-link'), 'dir')`.
   - Execute `file_read` with `{ filePath: 'outside-link/secret.txt' }`.
   - Assert `result.success` is `false`.
   - Assert `result.error?.code` is `INVALID_PARAMS`.
   - Assert `context.readState.hasRead(join(root, 'outside-link', 'secret.txt'))` is `false`.
   - Assert `context.readState.hasRead(join(outsideRoot, 'secret.txt'))` is `false`.
4. In the `Write tool` describe block, add a test:
   - Set up the same outside directory and in-workspace symlink pattern.
   - Create `secret.txt` in the outside directory with content `original`.
   - Execute `file_write` with `{ filePath: 'outside-link/secret.txt', content: 'changed' }`.
   - Assert `result.success` is `false`.
   - Assert `result.error?.code` is `INVALID_PARAMS`.
   - Assert `await readFile(join(outsideRoot, 'secret.txt'), 'utf-8')` is still `original`.
5. In the `Edit tool` describe block, add a test:
   - Set up the same outside directory and in-workspace symlink pattern.
   - Create `secret.txt` in the outside directory with content `hello secret`.
   - Mark the symlink lexical path as read with `context.readState.markRead(join(root, 'outside-link', 'secret.txt'))` to prove the workspace boundary check happens before edit access.
   - Execute `file_edit` with `{ filePath: 'outside-link/secret.txt', oldString: 'secret', newString: 'public' }`.
   - Assert `result.success` is `false`.
   - Assert `result.error?.code` is `INVALID_PARAMS`.
   - Assert `await readFile(join(outsideRoot, 'secret.txt'), 'utf-8')` is still `hello secret`.
6. Keep existing tests unchanged.

### Output

When done, report back to the coordinator:
- **Test file**: `packages/core/src/tools/registry.test.ts`
- **Test names**: exact names added.
- **Oracle confirmed**: whether tests fail before the fix and pass after the fix.
- **Risks or concerns**: any platform-specific symlink behavior.

---

## 4. Verification

1. Run the new read symlink test before the fix is applied:
   - Command: `pnpm test -- --run packages/core/src/tools/registry.test.ts -t "rejects a symlink path that resolves outside the workspace"`
   - Expected: Test fails on the unfixed lexical-only implementation because `file_read` succeeds and returns outside content.
2. Run after the fix is applied:
   - Command: `pnpm test -- --run packages/core/src/tools/registry.test.ts`
   - Expected: All registry/tool tests pass.
3. Run final focused verification:
   - Command: `pnpm typecheck`
   - Expected: TypeScript build succeeds.

---

## 5. Scope & References

### Allowed Files

- `packages/core/src/tools/registry.test.ts` - write symlink boundary regression tests here.

### Forbidden Files

- `packages/core/src/tools/workspace.ts` - source code is owned by the fix worker.
- `packages/core/src/tools/read-tool.ts` - source code is owned by the fix worker if needed.
- `packages/core/src/tools/write-tool.ts` - source code is owned by the fix worker if needed.
- `packages/core/src/tools/edit-tool.ts` - source code is owned by the fix worker if needed.
- `packages/core/src/tools/bash-tool.ts` - unrelated to current issue.
- `packages/core/src/context/**` - unrelated to current issue.
- Package manager files - no new dependencies are allowed.

### Related Documents

- `docs/plans/2026-06-21/agent-runtime-foundation/fix/FIX-01-symlink-workspace-boundary.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/DESIGN.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md`
