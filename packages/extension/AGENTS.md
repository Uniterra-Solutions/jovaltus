# jovaltus — VS Code Extension

VS Code extension providing the Jovaltus chat sidebar panel and bridging VS Code configuration to the core engine. Activates lazily on view open.

# MODULE FILE LIST

- `src/extension.ts` — `activate()` + `deactivate()` — registers ChatPanelProvider for `jovaltus.chatPanel`, wires SecretStorage
- `src/chat-panel.ts` — `ChatPanelProvider` (implements `WebviewViewProvider`) — serves Vite-bundled React webview, wires `AgentModeOrchestrator` events via postMessage, handles modelSwitch
- `src/config-provider.ts` — `VSCodeConfigProvider` — bridges VS Code `workspace.getConfiguration` + SecretStorage API keys to core's `ConfigProvider` interface
- `src/secrets.ts` — `JovaltusSecrets` — SecretStorage wrapper, supports one-time migration from plaintext config
- `src/__tests__/secrets.test.ts` — Unit tests for SecretStorage CRUD + migration
- `src/webview/` — React + assistant-ui webview application (Vite-bundled, tsc-excluded)
  - `src/webview/index.html` — HTML entry point
  - `src/webview/main.tsx` — React entry, renders `<App />`
  - `src/webview/App.tsx` — Root component: `useLocalRuntime` + `AssistantRuntimeProvider` + model state
  - `src/webview/vscode-bridge.ts` — `createVSCodeEventStream()` — Promise-based async iterable bridging postMessage events
  - `src/webview/chat-adapter.ts` — `createJovaltusAdapter()` — `ChatModelAdapter` converting orchestrator events → assistant-ui content chunks
  - `src/webview/__tests__/vscode-bridge.test.ts` — JSDOM tests for event stream async iteration + abort
  - `src/webview/__tests__/chat-adapter.test.ts` — JSDOM tests for adapter content conversion (streamDelta, toolCall, agentError, agentComplete)
  - `src/webview/components/ChatView.tsx` — Main chat view: `ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive` with grouped tool-call parts
  - `src/webview/components/ToolCallDisplay.tsx` — Collapsible tool call card (name, args, result, error state)
  - `src/webview/components/ModelSelector.tsx` — Model dropdown for Agent Mode
  - `src/webview/styles/index.css` — VS Code theme-adapted CSS (no Tailwind)
  - `src/webview/global.d.ts` — `acquireVsCodeApi` type declaration
- `vite.config.ts` — Vite config: React plugin, `src/webview` root, output to `dist/webview/`
- `tsconfig.webview.json` — JSX + DOM tsconfig for webview (Vite uses this; tsc -b does not)

# RULES SHOULD NOT BE VIOLATED

- Never import VS Code types outside of `@types/vscode` — the extension must stay within the VS Code API surface. Evidence: `package.json:7` (`engines.vscode: "^1.95.0"`)
- The extension is the **consumer** of `@jovaltus/core` — core must never depend on extension. Evidence: `packages/core/package.json` has zero extension dependencies
- Never add local resources to the webview without updating `localResourceRoots` and adding a Content-Security-Policy. Evidence: `chat-panel.ts:37-40` sets `localResourceRoots: ["dist/webview"]`
- Never change the view ID `jovaltus.chatPanel` without updating `activationEvents` in `package.json:11` — the lazy activation trigger depends on it. Evidence: `package.json:10-12`
- Configuration property keys under `jovaltus.*` must match the keys expected by core's `ConfigManager` — the dotted-key convention forms the integration contract. Evidence: `package.json:36-92`, `core/src/config/manager.ts:33`
- Never import from `@jovaltus/core` without first adding it to `package.json` dependencies — the extension declares `@jovaltus/core` as a `workspace:*` devDependency. Evidence: `package.json:108`
- The extension message protocol supports 8 event types (`assistantMessage`, `phaseStart`, `phaseEnd`, `streamDelta`, `toolCall`, `agentError`, `agentComplete`, `modelSwitch`) — changes to `AgentModeEvent` in core must be mirrored here. Evidence: `chat-panel.ts:46-60`
- `VSCodeConfigProvider` implements `ConfigProvider` with dotted-key convention matching core's `JovaltusConfig` structure — the dotted-key convention forms the integration contract. Evidence: `config-provider.ts:10-31`
- Never remove `.js` extensions from relative imports — NodeNext ESM. Evidence: `tsconfig.base.json:13`
- Webview source files live under `src/webview/` and are excluded from `tsc -b` — they are compiled by Vite separately. Evidence: `tsconfig.json:8`, `vite.config.ts`
- API keys must be stored in VS Code `SecretStorage`, not plaintext config. Evidence: `secrets.ts:18-22` — `JovaltusSecrets` wraps `context.secrets`; `config-provider.ts` reads API keys from SecretStorage cache
- Never add a webview source file without updating the module file list above. Evidence: webview file listing in MODULE FILE LIST
