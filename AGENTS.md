# Jovaltus — AGENTS.md

This file is for non-Claude agents (Codex, Copilot, etc.).

## Project Overview

Jovaltus is a TypeScript monorepo using pnpm workspaces. The core package (`packages/core`) provides a tool registry, built-in file/bash tools with read-before-write safety, and a context composer for single-agent runs.

## Module Boundaries

- **`packages/core/src/tools/`** — `ToolRegistry`, `ReadState`, built-in tools (`file_read`, `file_write`, `file_edit`, `bash`)
- **`packages/core/src/context/`** — `ContextComposer`, `ContextProvider`, `AgentContext`
- **`apps/extension/`** — IDE extension entry point (separate concern)

## Key Interfaces

- `ToolRegistry` — `register()`, `get()`, `getByName()`, `list()`, `execute()`
- `Tool` — `definition` + `parameters` + `handler`
- `ToolResult` — `success`, `data`, `error`
- `ReadState` — `hasRead()`, `markRead()`, `getReadFiles()`, `reset()`
- `ContextComposer` — `compose(options?)`
- `AgentContext` — `memory`, `skills`, `tools`, `mcps`

## Code Intelligence

CodeGraph is available for local exploration:

```
apltk codegraph query <symbol>
apltk codegraph context "question about the code"
apltk codegraph callers/callees <symbol>
apltk codegraph impact <symbol>
```
