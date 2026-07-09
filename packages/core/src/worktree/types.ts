export type WorktreeErrorCode =
  | 'WORKTREE_EXISTS'
  | 'BRANCH_EXISTS'
  | 'DIRTY_WORKTREE'
  | 'MERGE_CONFLICT'
  | 'NOT_FOUND'
  | 'GIT_ERROR';

export class WorktreeError extends Error {
  public readonly code: WorktreeErrorCode;
  public readonly gitStderr?: string;

  public constructor(
    message: string,
    code: WorktreeErrorCode,
    options?: { readonly gitStderr?: string },
  ) {
    super(message);
    this.name = 'WorktreeError';
    this.code = code;
    this.gitStderr = options?.gitStderr;
  }
}

export interface WorktreeEntry {
  readonly path: string;
  readonly branch: string;
  readonly head: string;
  readonly isMain: boolean;
}

export interface WorktreeCreateOptions {
  readonly branch: string;
  readonly path: string;
  readonly baseBranch?: string;
}

export interface WorktreeMergeResult {
  readonly success: boolean;
  readonly branch: string;
  readonly mergedCommit?: string;
  readonly error?: string;
}

export interface WorktreeDeleteOptions {
  readonly force?: boolean;
}
