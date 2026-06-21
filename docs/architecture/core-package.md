# Core Package Architecture

## Module Boundary: Tools

The tools module owns tool registration, discovery, execution, and session-level read tracking. It does not own agent loop orchestration or context composition.

**Evidence**: `packages/core/src/tools/` — `types.ts`, `registry.ts`, `read-state.ts`, `read-tool.ts`, `write-tool.ts`, `edit-tool.ts`, `bash-tool.ts`

### Tool Registry as Central Catalog

The `ToolRegistry` interface (`packages/core/src/tools/types.ts:83-105`) is the single point of tool discovery and execution for the runtime. It enforces:

- No duplicate id or name on registration (pre-registration check before indexing)
- Id-based lookup (`get(id)`) and name-based lookup (`getByName(name)`)
- Structured execution via `execute()` that catches handler exceptions and returns `ToolResult` objects instead of throwing

### Read-Before-Write Safety

The `ReadState` interface (`packages/core/src/tools/read-state.ts:7-19`) tracks per-session file reads. It uses path normalization (`resolvePath` + trailing-slash dedup) so the same file is recognized regardless of how the path was spelled. Read tool writes to `ReadState` only after a successful read; write and edit tools check `ReadState` before modifying existing files.

### Structured Error Contract

Every tool result is typed as `ToolResult` (`packages/core/src/tools/types.ts:28-32`) with `success`, optional `data`, and optional `error` containing a `ToolErrorCode` and message. The registry guarantees no exceptions escape `execute()` — unknown tools return `TOOL_NOT_FOUND`, handler exceptions are caught and returned as `UNKNOWN_ERROR`.

## Module Boundary: Context

The context module owns composing a single-agent context bundle from providers. It does not own memory persistence, skill marketplaces, or MCP server execution.

**Evidence**: `packages/core/src/context/` — `types.ts`, `composer.ts`

### Provider-Based Composition

`ContextProvider<T>` (`packages/core/src/context/types.ts:7-11`) is the abstraction for supplying a section of agent context. The composer accepts optional custom providers and falls back to default providers that return `null` (memory, skills, MCP) or empty tool lists.

### Tools-as-Metadata-Only

When the composer generates tool descriptions (`packages/core/src/context/composer.ts:47-67`), it reads only `definition` and `parameters` from registered tools. It never calls `handler`. This ensures context composition is side-effect-free.

## Data Flow

```
Runtime ──► ToolRegistry ──► execute(id, params, context) ──► ToolResult
                │
                ├── get(id)        ──► Tool | undefined
                ├── getByName(name) ──► Tool | undefined
                └── list()         ──► Tool[]

Runtime ──► ContextComposer ──► compose(options) ──► AgentContext
                │
                ├── memory provider ──► MemoryContext | null
                ├── skills provider ──► SkillsContext | null
                ├── tools provider   ──► ToolDescriptions (from ToolRegistry.list())
                └── MCP provider     ──► MCPContext | null
```

## Boundary Invariants

- Tool modules do not call context modules or agent loop logic
- Context modules read from ToolRegistry but never execute handlers
- ReadState is per-session; no cross-session sharing
- All public types are exported from `packages/core/src/index.ts`
