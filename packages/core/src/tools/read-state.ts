import { resolve as resolvePath } from 'node:path';

// ---------------------------------------------------------------------------
// ReadState – tracks which files the session has read.
// ---------------------------------------------------------------------------

export interface ReadState {
  /** Has the session read the file at the given path? */
  hasRead(filePath: string): boolean;

  /** Record that the session has read a file. */
  markRead(filePath: string): void;

  /** Snapshot of all read-file absolute paths. */
  getReadFiles(): readonly string[];

  /** Clear all read tracking. */
  reset(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Normalise a user-supplied path to an absolute path rooted at
 * `workspaceRoot`, then deduplicate trailing slashes so lookups are
 * consistent regardless of how the path was originally spelled.
 */
function normalise(filePath: string, workspaceRoot: string): string {
  const resolved = resolvePath(workspaceRoot, filePath);
  // Strip trailing slash for consistency (keep root `/` intact).
  return resolved.length > 1 && resolved.endsWith('/')
    ? resolved.slice(0, -1)
    : resolved;
}

export function createReadState(workspaceRoot?: string): ReadState {
  const root = workspaceRoot ?? process.cwd();
  const readFiles = new Set<string>();

  return {
    hasRead(filePath: string): boolean {
      return readFiles.has(normalise(filePath, root));
    },

    markRead(filePath: string): void {
      readFiles.add(normalise(filePath, root));
    },

    getReadFiles(): readonly string[] {
      return [...readFiles];
    },

    reset(): void {
      readFiles.clear();
    },
  };
}
