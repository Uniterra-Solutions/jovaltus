import type { ReadState } from './read-state.js';

export type { ReadState };

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type ToolErrorCode =
  | 'INVALID_PARAMS'
  | 'FILE_NOT_FOUND'
  | 'FILE_NOT_READ'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'EDIT_FAILED'
  | 'EXECUTION_FAILED'
  | 'TOOL_NOT_FOUND'
  | 'UNKNOWN_ERROR';

export interface ToolError {
  readonly code: ToolErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ToolResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ToolError;
}

// ---------------------------------------------------------------------------
// Tool metadata
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

/** JSON Schema object describing the tool's parameters. */
export interface ToolParameterSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface ToolContext {
  readonly workspaceRoot: string;
  readonly readState: ReadState;
  readonly signal?: AbortSignal;
}

export type ToolHandler = (
  params: Readonly<Record<string, unknown>>,
  context: ToolContext,
) => Promise<ToolResult>;

// ---------------------------------------------------------------------------
// Full tool descriptor (registered entry)
// ---------------------------------------------------------------------------

export interface Tool {
  readonly definition: ToolDefinition;
  readonly parameters: ToolParameterSchema;
  readonly handler: ToolHandler;
}

// ---------------------------------------------------------------------------
// Registry interface
// ---------------------------------------------------------------------------

export interface ToolRegistry {
  /** Register a tool. Throws on duplicate id or duplicate name. */
  register(tool: Tool): void;

  /** Look up a tool by id. Returns undefined when not found. */
  get(id: string): Tool | undefined;

  /** Look up a tool by name. Returns undefined when not found. */
  getByName(name: string): Tool | undefined;

  /** List every registered tool. */
  list(): readonly Tool[];

  /**
   * Execute a tool by id.
   * Returns a structured result — never throws.
   */
  execute(
    id: string,
    params: Readonly<Record<string, unknown>>,
    context: ToolContext,
  ): Promise<ToolResult>;
}
