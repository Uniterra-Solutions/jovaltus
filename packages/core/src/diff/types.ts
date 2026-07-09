export type DiffErrorCode = 'INVALID_RANGE' | 'COMMIT_NOT_FOUND' | 'EMPTY_DIFF' | 'GIT_ERROR';

export class DiffError extends Error {
  public readonly code: DiffErrorCode;
  public readonly gitStderr?: string;

  public constructor(
    message: string,
    code: DiffErrorCode,
    options?: { readonly gitStderr?: string },
  ) {
    super(message);
    this.name = 'DiffError';
    this.code = code;
    this.gitStderr = options?.gitStderr;
  }
}

export type DiffLevel = 'worker' | 'batch' | 'spec' | 'custom';

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export interface DiffFileEntry {
  readonly filePath: string;
  readonly addedLines: number;
  readonly deletedLines: number;
  readonly changeType: ChangeType;
}

export interface DiffResult {
  readonly files: readonly DiffFileEntry[];
  readonly summary: {
    readonly totalAdded: number;
    readonly totalDeleted: number;
    readonly totalFiles: number;
  };
  readonly rawDiff: string;
}

export interface DiffRequest {
  readonly startCommit: string;
  readonly endCommit: string;
  readonly level?: DiffLevel;
  readonly fileFilter?: readonly string[];
}
