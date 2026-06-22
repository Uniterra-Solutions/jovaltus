# packages/core

Core runtime — tool registry, built-in file/bash tools, read-state tracking, and context composition for single-agent runs.

## Module File List

- `src/index.ts` — Public API surface
- `src/index-task.ts` — AgentTask type and factory
- `src/tools/types.ts` — Tool, ToolRegistry, ToolResult, ToolError, ToolErrorCode, ReadState types
- `src/tools/registry.ts` — ToolRegistry implementation (register, get, list, execute)
- `src/tools/read-state.ts` — ReadState implementation (session read tracking)
- `src/tools/workspace.ts` — Workspace path containment (resolveInWorkspace)
- `src/tools/read-tool.ts` — file_read handler
- `src/tools/write-tool.ts` — file_write handler
- `src/tools/edit-tool.ts` — file_edit handler
- `src/tools/bash-tool.ts` — bash handler
- `src/tools/index.ts` — Tool barrel exports
- `src/tools/registry.test.ts` — Tool integration tests
- `src/tools/read-state.test.ts` — ReadState unit tests
- `src/context/types.ts` — ContextProvider, AgentContext, ContextComposer types
- `src/context/composer.ts` — ContextComposer implementation
- `src/context/index.ts` — Context barrel exports
- `src/context/composer.test.ts` — Context composer tests
- `src/index.test.ts` — Public API smoke test

## Rules Should Not Be Violated

- Tool modules must never import from context modules or agent loop logic
- Context modules must never execute tool handlers (metadata-only composition)
- All file tools (read/write/edit) must call `resolveInWorkspace()` before any filesystem I/O
- Bash tool must validate `timeoutMs` with range check before spawning child process
- `execute()` in registry must never throw — all errors are returned as structured ToolResult
- File write/edit handlers must check `readState.hasRead()` before modifying existing files
- No new dependencies without explicit approval — prefer Node built-in APIs
