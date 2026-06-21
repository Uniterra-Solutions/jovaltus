# Regression Test Worker Prompt: REGTEST-02-bash-timeout-validation

- **Related fix**: FIX-02 - bash timeout validation

---

## 1. Mission & Rules

### Mission

Add regression coverage proving invalid `timeoutMs` values return a structured bash tool validation error, not registry-level `UNKNOWN_ERROR`.

### Context

P1-002 was caused by forwarding unchecked numeric timeout values into Node `exec()`. The regression test must fail against the reviewed implementation and pass after `FIX-02`.

### Rules

- Only modify test files.
- The test must fail on the unfixed code and pass after `FIX-02`.
- Follow the existing style in `packages/core/src/tools/registry.test.ts`.
- Do not weaken existing bash success, failure, cwd, or invalid-command tests.
- Workers are leaf nodes - do not spawn sub-workers.

---

## 2. Context

### Input Files

- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` - Req 4 and structured validation expectations.
- `docs/plans/2026-06-21/agent-runtime-foundation/fix/FIX-02-bash-timeout-validation.md` - source fix context.
- `packages/core/src/tools/bash-tool.ts` - fixed timeout validation behavior.
- `packages/core/src/tools/registry.test.ts` - test file to update.

### Test Design

- **Test ID**: REGTEST-02
- **Type**: Integration-style unit test through `ToolRegistry.execute()`.
- **Location**: `packages/core/src/tools/registry.test.ts`
- **Scenario**: GIVEN the bash tool is registered, WHEN it is executed with a valid command and an out-of-range `timeoutMs`, THEN it returns `success: false` with `error.code: 'INVALID_PARAMS'`.
- **Oracle**: On the unfixed code, the result is `UNKNOWN_ERROR` or otherwise not `INVALID_PARAMS`; after `FIX-02`, the result is a bash-tool validation failure with `INVALID_PARAMS`.

---

## 3. Tasks

1. Open `packages/core/src/tools/registry.test.ts`.
2. In the `Bash tool` describe block, add a test near existing invalid parameter tests:
   - Create a temp context using existing `setup()`.
   - Register `createBashTool()` in a fresh registry.
   - Execute `bash` with a simple valid command such as `pwd` and `timeoutMs: Number.MAX_SAFE_INTEGER`.
   - Assert `result.success` is `false`.
   - Assert `result.error?.code` is `'INVALID_PARAMS'`.
   - Assert the error message mentions `timeoutMs`.
3. Do not assert exact full error-message wording unless the implementation intentionally stabilizes it.

### Output

When done, report back to the coordinator:
- **Test file**: `packages/core/src/tools/registry.test.ts`
- **Test name**: exact added test name
- **Oracle confirmed**: whether it fails before and passes after `FIX-02`
- **Risks or concerns**: or `None`

---

## 4. Verification

1. Run the new test against the unfixed bash tool if feasible.
   - Expected: fails because the result is not `INVALID_PARAMS`.
2. Run: `pnpm test -- --run packages/core/src/tools/registry.test.ts`
   - Expected: passes after `FIX-02`.
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
- `docs/plans/2026-06-21/agent-runtime-foundation/fix/FIX-02-bash-timeout-validation.md`
