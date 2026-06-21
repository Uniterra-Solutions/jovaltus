# Fix Plan: Agent Runtime Foundation Review Findings

- **Date**: 2026-06-22
- **Feature**: Agent Runtime Foundation
- **Source review**: Codex review of `HEAD` (`54c5a34 feat: implement agent runtime foundation`)
- **Related spec**: `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`
- **Related checklist**: `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md`

## Role

You are the fix coordinator. Execute this plan by dispatching focused fix and regression-test workers, checking their results, resolving integration issues, and verifying that all gates pass.

The coordinator does not redesign the feature. Keep changes scoped to the review findings below.

## Rules

Always:
- Follow the batch order exactly.
- Keep edits scoped to `packages/core/src/tools/**`, `packages/core/src/context/**`, and their tests unless a verification failure proves another file must change.
- Preserve the public tool and context APIs unless a type-only narrowing is required to remove unsafe `any`.
- Preserve structured `ToolResult` failures; do not let tool handlers throw through registry execution.
- Add regression tests that would fail on the reviewed implementation and pass after the fix.
- Run each batch gate before moving to the next batch.

Ask first:
- Before adding runtime dependencies.
- Before changing package manager files, extension app files, agent task APIs, or unrelated docs.
- Before broadening scope into agent loop orchestration, permission UI, sandbox enforcement, MCP execution, external memory persistence, or multi-agent behavior.

Never:
- Use destructive git commands.
- Revert unrelated user changes.
- Skip verification because a change is small.
- Parallelize workers that modify overlapping files.

## Issue Inventory

### P1-01: File tools allow paths outside the workspace

**Severity**: High

**Evidence**:
- `packages/core/src/tools/read-tool.ts` resolves `filePath` with `resolvePath(context.workspaceRoot, filePath)` but does not check containment before reading.
- `packages/core/src/tools/write-tool.ts` uses the same pattern and can create new files outside `workspaceRoot`.
- `packages/core/src/tools/edit-tool.ts` uses the same pattern and trusts read state for the resolved outside path.

**Impact**:
- Absolute paths and `../` traversal can read, create, overwrite, or edit files outside the configured workspace.
- This contradicts the tool description and the spec's workspace file boundary.
- The read-before-write guard does not protect non-existing outside paths because `file_write` permits creating new files.

**Required behavior**:
- File tools must reject any path whose resolved target is outside `context.workspaceRoot`.
- Rejections must be structured tool failures, preferably `INVALID_PARAMS`, before filesystem access.
- Valid in-workspace absolute paths may remain supported only if they resolve inside `workspaceRoot`.
- Existing read-before-write behavior must remain unchanged for valid in-workspace targets.

**Affected files**:
- `packages/core/src/tools/read-tool.ts`
- `packages/core/src/tools/write-tool.ts`
- `packages/core/src/tools/edit-tool.ts`
- `packages/core/src/tools/registry.test.ts`

### P2-01: Context composition fails wholesale when optional providers reject

**Severity**: Medium

**Evidence**:
- `packages/core/src/context/composer.ts` uses `Promise.all` over memory, skills, tools, and MCP providers.
- A rejected optional provider rejects the whole `compose()` call, so tool descriptions are not returned.

**Impact**:
- Optional memory, skill, or MCP source failures can prevent an agent run from receiving any context.
- This violates the spec requirement that unavailable optional context sources degrade to null or empty sections rather than failing the whole context request.

**Required behavior**:
- Memory, skills, and MCP provider failures must degrade to `null`.
- Tool descriptions should still be returned when the tool registry is available.
- Tool provider behavior must still avoid executing handlers.

**Affected files**:
- `packages/core/src/context/composer.ts`
- `packages/core/src/context/types.ts`
- `packages/core/src/context/composer.test.ts`

### P2-02: Lint gate fails

**Severity**: Medium

**Evidence**:
- `pnpm lint` fails with 13 errors:
  - `@typescript-eslint/require-await` in default context providers and tool provider.
  - `@typescript-eslint/no-unsafe-assignment` and `@typescript-eslint/no-unsafe-member-access` from `ContextComposerOptions.toolRegistry?: { list(): readonly any[] }`.
  - `@typescript-eslint/restrict-template-expressions` in bash error formatting.

**Impact**:
- The repository quality gate fails even though tests and typecheck pass.

**Required behavior**:
- `pnpm lint` must pass without disabling rules broadly.
- Replace `any` with a narrow registry/list item type compatible with existing tool registries and tests.
- Remove unnecessary `async` keywords where no await is needed, or otherwise make the provider implementation intentionally async without lint violations.
- Convert bash error code formatting to a lint-safe string.

**Affected files**:
- `packages/core/src/context/types.ts`
- `packages/core/src/context/composer.ts`
- `packages/core/src/tools/bash-tool.ts`
- Tests only if type narrowing requires test fixture updates.

## Fix Batches

### Batch 1: Workspace Path Containment

**Mode**: Single worker, sequential

**Worker prompt**:

```
Fix P1-01 in the Agent Runtime Foundation.

Read:
- docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md
- packages/core/src/tools/read-tool.ts
- packages/core/src/tools/write-tool.ts
- packages/core/src/tools/edit-tool.ts
- packages/core/src/tools/read-state.ts
- packages/core/src/tools/registry.test.ts

Implement workspace containment for file tools.

Requirements:
- Resolve each requested file path against context.workspaceRoot.
- Reject targets outside context.workspaceRoot before any filesystem access.
- Return a structured failure with code INVALID_PARAMS and a clear message.
- Preserve existing behavior for valid in-workspace relative paths.
- Preserve support for valid in-workspace absolute paths if they resolve inside workspaceRoot.
- Preserve read-before-write behavior for existing in-workspace files.
- Avoid broad public API changes.

Add regression tests in packages/core/src/tools/registry.test.ts:
- file_read rejects ../ traversal outside the workspace and does not mark read state.
- file_read rejects an absolute path outside the workspace.
- file_write rejects ../ traversal outside the workspace and does not create the outside file.
- file_write rejects an absolute path outside the workspace.
- file_edit rejects outside-workspace paths before editing.
- At least one test proves a valid in-workspace path still succeeds.

Verification:
- pnpm test -- --run packages/core/src/tools/registry.test.ts
- pnpm typecheck
```

**Allowed files**:
- `packages/core/src/tools/read-tool.ts`
- `packages/core/src/tools/write-tool.ts`
- `packages/core/src/tools/edit-tool.ts`
- `packages/core/src/tools/registry.test.ts`
- Optional shared helper under `packages/core/src/tools/` if it keeps duplication lower.

**Batch gate**:
- `pnpm test -- --run packages/core/src/tools/registry.test.ts`
- `pnpm typecheck`

### Batch 2: Context Failure Degradation and Type Safety

**Mode**: Single worker, sequential

**Worker prompt**:

```
Fix P2-01 and the context-related parts of P2-02.

Read:
- docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md
- packages/core/src/context/types.ts
- packages/core/src/context/composer.ts
- packages/core/src/context/composer.test.ts
- packages/core/src/tools/types.ts

Implement graceful optional-provider failure handling in ContextComposer.

Requirements:
- If memory provider rejects, compose() returns memory: null.
- If skills provider rejects, compose() returns skills: null.
- If MCP provider rejects, compose() returns mcps: null.
- Tool descriptions are still returned when optional providers fail.
- Tool handlers must not execute during composition.
- Replace unsafe any in ContextComposerOptions with a narrow type that describes only the registry list() shape needed by the composer.
- Remove require-await lint errors in default providers and tool provider without suppressing rules broadly.

Add regression tests in packages/core/src/context/composer.test.ts:
- compose() resolves with tool descriptions even when memory, skills, and MCP providers reject.
- each failed optional provider degrades to null.
- existing custom provider and no-handler-execution tests still pass.

Verification:
- pnpm test -- --run packages/core/src/context/composer.test.ts
- pnpm typecheck
```

**Allowed files**:
- `packages/core/src/context/types.ts`
- `packages/core/src/context/composer.ts`
- `packages/core/src/context/composer.test.ts`

**Batch gate**:
- `pnpm test -- --run packages/core/src/context/composer.test.ts`
- `pnpm typecheck`

### Batch 3: Remaining Lint Cleanup

**Mode**: Single worker, sequential

**Worker prompt**:

```
Fix the remaining P2-02 lint failures after Batches 1 and 2.

Run pnpm lint and address only lint failures in files touched by this fix plan or files identified in the issue inventory.

Known target:
- packages/core/src/tools/bash-tool.ts has a restrict-template-expressions failure for the command error code. Convert the value to an explicit string before interpolating.

Requirements:
- Do not change bash tool behavior except lint-safe formatting.
- Do not suppress lint rules broadly.
- Keep structured EXECUTION_FAILED details unchanged where possible.

Verification:
- pnpm lint
- pnpm typecheck
```

**Allowed files**:
- `packages/core/src/tools/bash-tool.ts`
- Any Batch 1 or Batch 2 file only if lint reports a remaining issue there.

**Batch gate**:
- `pnpm lint`
- `pnpm typecheck`

## Regression Test Batches

### Regression Batch 1: File Boundary Tests

**Mode**: Covered by Batch 1 worker

**Oracle**:
- The new outside-workspace tests must fail on the reviewed implementation because it does not perform containment checks.
- The tests must pass after Batch 1.

**Gate**:
- `pnpm test -- --run packages/core/src/tools/registry.test.ts`

### Regression Batch 2: Context Provider Failure Tests

**Mode**: Covered by Batch 2 worker

**Oracle**:
- The new provider rejection test must fail on the reviewed implementation because `Promise.all` rejects the whole composition.
- The test must pass after Batch 2.

**Gate**:
- `pnpm test -- --run packages/core/src/context/composer.test.ts`

## Final Verification

Run all of:

```
pnpm test
pnpm typecheck
pnpm lint
```

Confirm:
- File tools cannot access targets outside `workspaceRoot`.
- Read-before-write still rejects unread existing in-workspace files.
- Write/edit rejection leaves file contents unchanged.
- Context composer still describes tools without executing handlers.
- Optional context provider failures degrade to null sections.
- No new runtime dependencies were added.
- No unrelated files were modified.

## Expected Summary

When complete, report:
- Fixed issues by ID: P1-01, P2-01, P2-02.
- Verification command results.
- Any residual risk, especially around symlink traversal if not explicitly handled.
