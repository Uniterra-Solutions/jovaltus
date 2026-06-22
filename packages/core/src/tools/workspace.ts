import { realpath } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

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
 * result stays inside the workspace directory — both lexically and
 * canonically (after symlink resolution). Returns the resolved absolute
 * path on success, or an `INVALID_PARAMS` error when the target escapes the
 * workspace boundary.
 *
 * Symlink attacks such as `link-to-outside/secret.txt` where the first
 * component is a symlink to a directory outside the workspace are caught
 * because the canonical (realpath-resolved) target is checked against the
 * canonical workspace root.
 *
 * Absolute paths that happen to resolve to a location inside `workspaceRoot`
 * (e.g. `/workspace/root/sub/file.txt` when `workspaceRoot` is `/workspace/root`)
 * are accepted; they do not need to be relative.
 */
export async function resolveInWorkspace(
  workspaceRoot: string,
  requestedPath: string,
): Promise<WorkspaceResult> {
  // 1. Resolve the requested path against the ORIGINAL (non-canonicalised)
  //    workspace root. We keep the original root for the lexical resolution
  //    so that returned paths are consistent with how callers (and ReadState)
  //    expect them — on macOS, /tmp and /var are symlinks to /private/tmp and
  //    /private/var, and using the canonical workspace root for resolution
  //    would produce paths that ReadState lookups don't recognise.
  const resolved = resolve(workspaceRoot, requestedPath);
  const rel = relative(workspaceRoot, resolved);

  // 3. Lexical containment check — fast path for obvious escapes (../, or an
  //    absolute path that lexically falls outside the workspace). This runs
  //    before any filesystem access so trivial traversal attempts are rejected
  //    immediately.
  //
  //    When `rel` equals `..` (exact parent directory) or starts with `../` (or
  //    the platform-specific equivalent, e.g. `..\\` on Windows), the resolved
  //    path escapes the workspace. Legitimate path segments whose name begins
  //    with two dots (e.g. `..foo`) are unaffected.
  if (rel === '..' || rel.startsWith('..' + sep)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PARAMS',
        message: `Path '${requestedPath}' resolves outside the workspace. All file paths must be within ${workspaceRoot}.`,
      },
    };
  }

  // 4. Canonicalise the workspace root (resolve its own symlinks) so we have a
  //    reliable reference for the realpath-based containment checks below.
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(workspaceRoot);
  } catch {
    canonicalRoot = workspaceRoot;
  }

  // 5. For targets that already exist on disk, canonicalise them via realpath
  //    and verify containment against the canonical workspace root. This
  //    catches symlink-based escapes where a path component points to a
  //    directory outside the workspace (e.g. `link-to-outside/secret.txt`).
  //    An existing target whose canonical path stays inside the workspace is
  //    safe — we return the original resolved path for caller consistency.
  try {
    const canonicalTarget = await realpath(resolved);
    const targetRel = relative(canonicalRoot, canonicalTarget);
    if (targetRel === '..' || targetRel.startsWith('..' + sep)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PARAMS',
          message: `Path '${requestedPath}' resolves outside the workspace through a symlink. All file paths must be within ${workspaceRoot}.`,
        },
      };
    }
    return { ok: true, path: resolved };
  } catch {
    // Target does not exist on disk — proceed to parent-walk below.
  }

  // 6. For targets that do not yet exist (e.g. a new file to be written), walk
  //    up the directory chain to find the nearest existing ancestor,
  //    canonicalise it, and verify containment. This prevents writes through a
  //    symlinked directory that points outside the workspace, such as
  //    `link-to-outside/new-file.txt`.
  let current = dirname(resolved);
  while (current !== canonicalRoot) {
    try {
      const canonicalParent = await realpath(current);
      const parentRel = relative(canonicalRoot, canonicalParent);
      if (parentRel === '..' || parentRel.startsWith('..' + sep)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_PARAMS',
            message: `Path '${requestedPath}' resolves outside the workspace through a symlink. All file paths must be within ${workspaceRoot}.`,
          },
        };
      }
      break; // parent exists and is inside workspace
    } catch {
      const parent = dirname(current);
      if (parent === current) break; // reached filesystem root
      current = parent;
    }
  }

  // 7. Containment confirmed (lexical check passed + realpath check passed
  //    for the nearest existing ancestor, or the path was entirely under the
  //    canonical root). Return the resolved (non-canonical) path so the
  //    caller can use it with ReadState and filesystem operations normally.
  return { ok: true, path: resolved };
}
