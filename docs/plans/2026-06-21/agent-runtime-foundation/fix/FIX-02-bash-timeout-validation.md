# Fix Worker Prompt: FIX-02-bash-timeout-validation

- **Related issue**: P1-002 - invalid bash timeout values surface as `UNKNOWN_ERROR`

---

## 1. Mission & Rules

### Mission

Validate `timeoutMs` before calling `exec()` so invalid timeout parameters return a structured bash tool error instead of throwing through registry exception handling.

### Context

The review flagged a spec implementation omission for Req 4. Bash command inputs need typed validation or structured execution outcomes suitable for runtime consumption.

### Rules

- Follow the Scope in Section 5.
- Preserve default timeout behavior when `timeoutMs` is omitted.
- Preserve successful command execution behavior and existing `EXECUTION_FAILED` details for command failures.
- Return structured `ToolResult` failures for invalid timeout input; do not rely on registry `UNKNOWN_ERROR`.
- Do not add dependencies.
- Workers are leaf nodes - do not spawn sub-workers.

---

## 2. Context

### Input Files

- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` - Req 4 and data-boundary error expectations.
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md` - P1-002 issue details.
- `packages/core/src/tools/bash-tool.ts` - handler to fix.
- `packages/core/src/tools/types.ts` - structured tool error/result types.
- `packages/core/src/tools/registry.test.ts` - existing bash tests to keep passing.

### Root Cause

`packages/core/src/tools/bash-tool.ts` accepts any JavaScript number as `timeoutMs` and passes it to Node `exec()`. Values outside Node's accepted timeout range can throw synchronously or otherwise fail before the bash tool returns a controlled validation or execution result.

---

## 3. Tasks

### `packages/core/src/tools/bash-tool.ts` - validate timeout parameter

1. Open `packages/core/src/tools/bash-tool.ts`.
2. Locate the handler around lines 38-55.
3. Keep the existing command validation.
4. Change timeout handling so:
   - If `params.timeoutMs` is `undefined`, use `DEFAULT_TIMEOUT_MS`.
   - If `params.timeoutMs` is present but not a number, return `success: false` with `error.code: 'INVALID_PARAMS'`.
   - If `params.timeoutMs` is `NaN`, infinite, negative, or larger than Node's valid timeout range, return `success: false` with `error.code: 'INVALID_PARAMS'`.
   - Prefer an integer millisecond timeout; reject non-integer values unless the codebase already has a clear convention for coercion.
5. Use a named constant for the maximum valid timeout if that makes the validation self-explanatory.
6. Keep the `exec()` call and `EXECUTION_FAILED` branch behavior otherwise unchanged.

### Output

When done, report back to the coordinator:
- **Files modified**: expected `packages/core/src/tools/bash-tool.ts`
- **Change summary**: describe timeout validation added
- **Test results**: command outputs and pass/fail
- **Risks or concerns**: any uncertainty about Node timeout bounds

---

## 4. Verification

1. Run: `pnpm typecheck`
   - Expected: passes.
2. Run: `pnpm test -- --run packages/core/src/tools/registry.test.ts`
   - Expected: passes.

---

## 5. Scope & References

### Allowed Files

- `packages/core/src/tools/bash-tool.ts` - required source fix.

### Forbidden Files

- `packages/core/src/tools/registry.test.ts` - owned by regression-test workers.
- `packages/core/src/tools/workspace.ts` - owned by `FIX-01`.
- `apps/extension/**` - out of scope.
- Package manager files - no dependency changes are needed.

### Related Documents

- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/FIX.md`
