# Error Handling Conventions

## Structured Tool Results

Every tool operation returns a `ToolResult` object with `success`, optional `data`, and optional `error` fields. Errors are never thrown past the registry boundary.

```typescript
interface ToolResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ToolError;
}
```

**Evidence**: `packages/core/src/tools/types.ts:28-32`

**Reason**: Structured results allow agent loops to inspect failure details (error code, message, optional details) without try/catch around every tool call.

## Categorized Error Codes

Tool errors use a `ToolErrorCode` discriminated union:

```typescript
type ToolErrorCode =
  | 'INVALID_PARAMS'
  | 'FILE_NOT_FOUND'
  | 'FILE_NOT_READ'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'EDIT_FAILED'
  | 'EXECUTION_FAILED'
  | 'TOOL_NOT_FOUND'
  | 'UNKNOWN_ERROR';
```

**Evidence**: `packages/core/src/tools/types.ts:7-16`

**Reason**: Categorized codes let the runtime handle failures by category (e.g., retry on `EXECUTION_FAILED`, prompt user on `FILE_NOT_READ`) without parsing free-form messages.

## Registry-Level Exception Safety

The registry's `execute()` wraps every handler call in a try/catch. Any thrown exception is converted to a `ToolResult` with code `UNKNOWN_ERROR` and the original error in `details`. This guarantees that tool handlers cannot crash the runtime through unhandled exceptions.

**Evidence**: `packages/core/src/tools/registry.ts:43-54`

**Reason**: Handler code may encounter unexpected failures. A thrown exception should become a machine-consumable failure, not propagate as an uncaught error.

## Validation at Entry

Invalid parameters (empty file paths, non-string content, empty commands) are rejected at the start of each tool handler with `INVALID_PARAMS` before any I/O occurs. This prevents partial I/O effects from invalid input.

**Evidence**: Each tool's handler checks required parameters before accessing the filesystem or process. (`packages/core/src/tools/read-tool.ts`, `write-tool.ts`, `edit-tool.ts`, `bash-tool.ts`)

**Reason**: Fail-fast validation prevents wasted I/O and ensures consistent error responses for invalid input.
