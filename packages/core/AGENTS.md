# @jovaltus/core — Core Engine

Pure TypeScript library providing agent factory, model abstraction, configuration management, and built-in tools. Zero VS Code dependency. Consumed by the extension package.

# MODULE FILE LIST

- `src/index.ts` — Public API barrel (explicit named exports, no wildcard re-exports)
- `src/agent/factory.ts` — `createAgent()` and `createModelRegistry()` — bridges JovaltusConfig → pi-ai/pi-agent-core
- `src/agent/index.ts` — Agent module barrel
- `src/agent/restrict-directory.ts` — `restrictToDirectory()` — beforeToolCall hook blocking out-of-dir path access
- `src/agent/tool-registry.ts` — `ToolRegistry` — Map-based in-memory tool registry
- `src/agent/types.ts` — `AgentRole`, `AgentContext`, `CreateAgentOptions` types
- `src/agent/tools/bash.ts` — `bashTool` — /bin/bash execution, 50KB truncation
- `src/agent/tools/edit.ts` — `editTool` — exact-string replace with uniqueness guard
- `src/agent/tools/index.ts` — Tool barrel + three presets: READ_ONLY_TOOLS, READ_WRITE_TOOLS, VERIFY_TOOLS
- `src/agent/tools/read.ts` — `readTool` — cat -n style paginated file reader
- `src/agent/tools/write.ts` — `writeTool` — file writer with auto parent-dir creation
- `src/config/context-window.ts` — `resolveContextWindow()` + `discoverContextWindow()` — /models endpoint auto-discovery
- `src/config/defaults.ts` — `DEFAULT_CONFIG` — static fallback values
- `src/config/manager.ts` — `ConfigManager` — three-layer config resolution via `ConfigProvider` interface
- `src/config/types.ts` — `JovaltusConfig`, `ModelConfig`, `ProviderConfig`, `ConfigProvider` types
- `src/model/anthropic-provider.ts` — `AnthropicProvider` — adapter wrapping @anthropic-ai/sdk
- `src/model/client.ts` — `ModelClient` interface + `createModelClient()` factory
- `src/model/errors.ts` — `ModelError` (6 error codes) + `statusToCode()` + `classifyError()` + `parseRetryAfter()`
- `src/model/openai-provider.ts` — `OpenAIProvider` — adapter wrapping `openai` SDK
- `src/model/types.ts` — `ChatMessage`, `CompletionRequest`, `CompletionResponse`, `TokenUsage` DTOs

# RULES SHOULD NOT BE VIOLATED

- Never import from the extension package — core has zero VS Code dependency and must stay host-agnostic. Evidence: `package.json` has no `vscode` or extension references in dependencies
- Never remove `.js` extensions from relative imports — required by NodeNext module resolution. Evidence: `tsconfig.base.json:13` (`module: "NodeNext"`). Pattern: every source file uses `./foo.js` for internal imports
- Never add a new public symbol without updating `src/index.ts` — the barrel is the contract. Evidence: `src/index.ts:1-36` lists every exported symbol explicitly
- Never throw from tool execute functions — tools return structured `AgentToolResult` with `content` + `details`, never throw on expected failures. Evidence: `src/agent/tools/edit.ts:27-32`, `src/agent/tools/bash.ts:28-36` return results on error, never throw
- `src/agent/` must never import from `src/model/` — the two LLM access paths are independent and share only config types. Evidence: `src/agent/factory.ts:1-13` imports from pi-ai/pi-agent-core + config types only, no model/ imports
- Never break the Tool contract — every tool must have `name`, `label`, `description`, `parameters` (TypeBox), and `execute(id, params, signal)` returning `AgentToolResult`. Evidence: all four tools in `src/agent/tools/` follow this exact shape
- Never expose internal modules through barrel exports — `index.ts` files use explicit named exports only, no `export * from`. Evidence: `src/index.ts`, `src/agent/index.ts` list every symbol individually
