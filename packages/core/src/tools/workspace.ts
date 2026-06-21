import { relative, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Workspace containment helpers
// ---------------------------------------------------------------------------

export interface WorkspaceSuccess {
  ok: true;
  path: string;
}

export interface WorkspaceViolation {
  ok: false;
  error: {
    code: 'INVALID_PARAMS';
    message: string;
  };
}

export type WorkspaceResult = WorkspaceSuccess | WorkspaceViolation;

/**
 * Resolve `requestedPath` relative to `workspaceRoot` and verify that the
 * result stays inside the workspace directory. Returns the resolved absolute
 * path on success, or an `INVALID_PARAMS` error when the target escapes the
 * workspace boundary.
 *
 * Absolute paths that happen to resolve to a location inside `workspaceRoot`
 * (e.g. `/workspace/root/sub/file.txt` when `workspaceRoot` is `/workspace/root`)
 * are accepted; they do not need to be relative.
 */
export function resolveInWorkspace(
  workspaceRoot: string,
  requestedPath: string,
): WorkspaceResult {
  const resolved = resolve(workspaceRoot, requestedPath);
  const rel = relative(workspaceRoot, resolved);

  // When `rel` starts with `..` the resolved path is outside the workspace.
  if (rel.startsWith('..')) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PARAMS',
        message: `Path '${requestedPath}' resolves outside the workspace. All file paths must be within ${workspaceRoot}.`,
      },
    };
  }

  return { ok: true, path: resolved };
}
