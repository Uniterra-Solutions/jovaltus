export type PlannerErrorCode = 'CIRCULAR_DEPENDENCY' | 'INVALID_DEPENDENCY' | 'EMPTY_TASK_LIST';

export class PlannerError extends Error {
  public readonly code: PlannerErrorCode;
  public readonly affectedTasks?: readonly string[];

  public constructor(
    message: string,
    code: PlannerErrorCode,
    options?: { readonly affectedTasks?: readonly string[] },
  ) {
    super(message);
    this.name = 'PlannerError';
    this.code = code;
    this.affectedTasks = options?.affectedTasks;
  }
}

export interface TaskInput {
  readonly id: string;
  readonly expectedFiles: readonly string[];
  readonly dependsOn?: readonly string[];
  readonly producesOutput?: readonly string[];
}

export interface TaskNode {
  readonly id: string;
  readonly expectedFiles: readonly string[];
  readonly producesOutput: readonly string[];
}

export interface Batch {
  readonly tasks: readonly TaskNode[];
  readonly batchIndex: number;
}

export interface PlanResult {
  readonly batches: readonly Batch[];
  readonly totalBatches: number;
}
