# Fix Worker Prompt: FIX-01-symlink-workspace-boundary

- **Related issue**: P2-001 - Symlink workspace-boundary risk

---

## 1. Mission & Rules

### Mission

Harden workspace path resolution so file tools reject paths that appear inside the workspace but resolve through symlinks to filesystem targets outside the workspace.

### Context

`REPORT.md` flags an architecture/security boundary risk for Req 2 and Req 3. `resolveInWorkspace()` currently checks `path.resolve()` plus `path.relative()` before file operations. That lexical check rejects obvious `../outside` paths, but it does not account for symlinks followed by Node file APIs.

### Rules

- Follow the Scope in Section 5 - only modify files listed as Allowed.
- Preserve existing test semantics - do not weaken, skip, or remove existing tests.
- Preserve public tool ids, names, parameter schemas, registry APIs, and `ToolResult` shapes.
- Expected workspace-boundary failures must return `{ success: false, error: { code: 'INVALID_PARAMS', ... } }`.
- Do not add external dependencies.
- Workers are leaf nodes - do not spawn sub-workers.

---

## 2. Context

### Input Files

- `packages/core/src/tools/workspace.ts` - current `resolveInWorkspace()` implementation and primary fix target.
- `packages/core/src/tools/read-tool.ts` - uses `resolveInWorkspace()` before `readFile()` and marks read state with the returned path.
- `packages/core/src/tools/write-tool.ts` - uses `resolveInWorkspace()` before existence checks and writes.
- `packages/core/src/tools/edit-tool.ts` - uses `resolveInWorkspace()` before read-state checks and edits.
- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md` - issue definition for `P2-001`.
- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` - Req 2, Req 3, and data-boundary expectations.
- `docs/plans/2026-06-21/agent-runtime-foundation/DESIGN.md` - invariant that workspace filesystem access stays inside the workspace and read/write/edit normalize paths consistently.
- `docs/plans/2026-06-21/agent-runtime-foundation/references/node-runtime-apis.md` - Node API constraints and no-new-dependency requirement.

### Root Cause

`resolveInWorkspace()` currently returns a lexical absolute path from `path.resolve(workspaceRoot, requestedPath)`. A path such as `link-to-outside/secret.txt` can lexically sit under `workspaceRoot`, while `readFile()` or `writeFile()` follows `link-to-outside` to content outside `workspaceRoot`. The containment decision and the actual filesystem target are therefore not the same boundary.

---

## 3. Tasks

### `packages/core/src/tools/workspace.ts` - canonicalize paths before accepting them

1. Open `packages/core/src/tools/workspace.ts`.
2. Locate `resolveInWorkspace()` at lines 32-54.
3. Change the helper so it can validate the canonical filesystem target, not only the lexical path:
   - Import Node filesystem promise APIs needed for canonicalization, such as `realpath`.
   - Convert `resolveInWorkspace()` to `async`.
   - Canonicalize `workspaceRoot` with `realpath(workspaceRoot)`.
   - Resolve `requestedPath` relative to the canonical workspace root.
   - Preserve a lexical containment check before filesystem access so obvious `../` and absolute outside paths still return `INVALID_PARAMS`.
   - For an existing target, canonicalize it with `realpath(resolved)` and run the containment check against the canonical workspace root.
   - For a non-existing target, canonicalize the nearest existing parent directory and run the containment check against the canonical workspace root, so new-file writes through a symlinked directory outside the workspace are rejected.
   - Preserve valid in-workspace paths whose first segment begins with `..` but is not a parent traversal, such as `..foo/file.txt`.
4. Keep the returned success path consistent across read, write, edit, and read-state checks. Existing targets should return the canonical target path after realpath validation. New targets should return the intended resolved path only after the canonical parent directory is confirmed inside the workspace.
5. Keep `WorkspaceViolation` as `INVALID_PARAMS` with a clear workspace-boundary message.

### `packages/core/src/tools/read-tool.ts`, `write-tool.ts`, and `edit-tool.ts` - await the async helper if needed

1. Open each file.
2. Locate calls to `resolveInWorkspace(...)`:
   - `read-tool.ts` around lines 42-46.
   - `write-tool.ts` around lines 69-73.
   - `edit-tool.ts` around lines 63-67.
3. If `resolveInWorkspace()` is now async, update each call to `await resolveInWorkspace(...)`.
4. Preserve all existing validation and structured error behavior.

### Output

When done, report back to the coordinator:
- **Files modified**: list source files changed.
- **Change summary**: how symlink escape paths are rejected and how valid paths are preserved.
- **Test results**: commands run and pass/fail status.
- **Risks or concerns**: any platform-specific symlink limitation or ambiguity.

---

## 4. Verification

1. Run: `pnpm typecheck`
   - Expected: TypeScript build succeeds with no errors.
2. Run: `pnpm test -- --run packages/core/src/tools/registry.test.ts`
   - Expected: Existing registry and tool tests pass.
3. Manually inspect behavior in code:
   - Obvious outside paths still return `INVALID_PARAMS`.
   - Existing normal files still return canonical paths that match read-state checks.
   - New file writes through symlinked parent directories outside the workspace cannot pass containment.

---

## 5. Scope & References

### Allowed Files

- `packages/core/src/tools/workspace.ts` - primary source fix.
- `packages/core/src/tools/read-tool.ts` - allowed only for async helper integration.
- `packages/core/src/tools/write-tool.ts` - allowed only for async helper integration.
- `packages/core/src/tools/edit-tool.ts` - allowed only for async helper integration.

### Forbidden Files

- `packages/core/src/tools/registry.test.ts` - owned by the regression-test worker.
- `packages/core/src/tools/bash-tool.ts` - unrelated to current issue.
- `packages/core/src/context/**` - unrelated to current issue.
- `apps/extension/**` - outside current core-package fix scope.
- Package manager files - no new dependencies are allowed.

### Related Documents

- `docs/plans/2026-06-21/agent-runtime-foundation/REPORT.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/DESIGN.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md`
- `docs/plans/2026-06-21/agent-runtime-foundation/references/node-runtime-apis.md`
