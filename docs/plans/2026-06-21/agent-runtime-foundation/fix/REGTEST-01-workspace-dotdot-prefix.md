# Regression Test Worker Prompt: REGTEST-01-workspace-dotdot-prefix

- **Related fix**: FIX-01 - workspace `..` prefix containment

---

## 1. Mission & Rules

### Mission

Add regression coverage proving valid in-workspace paths whose first segment begins with `..` are accepted by the file tools.

### Context

P1-001 was caused by `resolveInWorkspace()` rejecting every relative result that starts with `..`, including legitimate segment names like `..foo`. The regression test must fail against the reviewed implementation and pass after `FIX-01`.

### Rules

- Only modify test files.
- The test must fail on the unfixed code and pass after `FIX-01`.
- Follow the existing style in `packages/core/src/tools/registry.test.ts`.
- Do not weaken or remove existing path traversal tests.
- Workers are leaf nodes - do not spawn sub-workers.

---

## 2. Context

### Input Files

- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` - Req 2 and Req 3 expected file-tool behavior.
- `docs/plans/2026-06-21/agent-runtime-foundation/fix/FIX-01-workspace-dotdot-prefix.md` - source fix context.
- `packages/core/src/tools/workspace.ts` - fixed helper behavior.
- `packages/core/src/tools/registry.test.ts` - test file to update.

### Test Design

- **Test ID**: REGTEST-01
- **Type**: Integration-style unit test with temp filesystem.
- **Location**: `packages/core/src/tools/registry.test.ts`
- **Scenario**: GIVEN a workspace containing a directory named `..foo`, WHEN `file_read` reads `..foo/hello.txt`, THEN the read succeeds and marks the resolved in-workspace file as read.
- **Oracle**: On the unfixed code, the read returns `INVALID_PARAMS`; after `FIX-01`, it returns `success: true` and the expected file content.

---

## 3. Tasks

1. Open `packages/core/src/tools/registry.test.ts`.
2. In the `Read tool` describe block, add a test near the path-boundary cases:
   - Create a temp workspace using existing `setup()`.
   - Create a directory named `..foo` under the workspace.
   - Write `hello.txt` inside that directory.
   - Execute `file_read` with `{ filePath: '..foo/hello.txt' }`.
   - Assert `result.success` is `true`.
   - Assert `result.data` is the file content.
   - Assert `context.readState.hasRead(join(root, '..foo', 'hello.txt'))` is `true`.
3. Keep existing outside-workspace rejection tests unchanged.

### Output

When done, report back to the coordinator:
- **Test file**: `packages/core/src/tools/registry.test.ts`
- **Test name**: exact added test name
- **Oracle confirmed**: whether it fails before and passes after `FIX-01`
- **Risks or concerns**: or `None`

---

## 4. Verification

1. Run the new test against the unfixed helper if feasible.
   - Expected: fails because the result is `INVALID_PARAMS`.
2. Run: `pnpm test -- --run packages/core/src/tools/registry.test.ts`
   - Expected: passes after `FIX-01`.
3. Run: `pnpm typecheck`
   - Expected: passes.

---

## 5. Scope & References

### Allowed Files

- `packages/core/src/tools/registry.test.ts` - write the regression test here.

### Forbidden Files

- All source files under `packages/core/src/tools/*.ts` - regression worker must not modify source code.
- Package manager files - no dependency changes are needed.

### Related Documents

- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/fix/FIX-01-workspace-dotdot-prefix.md`
