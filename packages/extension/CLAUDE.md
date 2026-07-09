# jovaltus — VS Code Extension

VS Code extension providing the Jovaltus chat sidebar panel and bridging VS Code configuration to the core engine. Activates lazily on view open.

# MODULE FILE LIST

- `src/extension.ts` — `activate()` + `deactivate()` — registers ChatPanelProvider for `jovaltus.chatPanel`
- `src/chat-panel.ts` — `ChatPanelProvider` (implements `WebviewViewProvider`) + `getWebviewHtml()` — inline HTML/CSS/JS chat UI, wired to `@jovaltus/core` via `AgentModeOrchestrator`
- `src/chat-panel.ts:356-365` — `VSCodeConfigProvider` — bridges VS Code `workspace.getConfiguration` to core's `ConfigProvider` interface

# RULES SHOULD NOT BE VIOLATED

- Never import VS Code types outside of `@types/vscode` — the extension must stay within the VS Code API surface. Evidence: `package.json:7` (`engines.vscode: "^1.95.0"`)
- The extension is the **consumer** of `@jovaltus/core` — core must never depend on extension. Evidence: `packages/core/package.json` has zero extension dependencies
- Never add local resources to the webview without updating `localResourceRoots` and adding a Content-Security-Policy. Evidence: `chat-panel.ts:162` sets `localResourceRoots: []` — currently no local assets
- Never change the view ID `jovaltus.chatPanel` without updating `activationEvents` in `package.json:11` — the lazy activation trigger depends on it. Evidence: `package.json:10-12`
- Configuration property keys under `jovaltus.*` must match the keys expected by core's `ConfigManager` — the dotted-key convention forms the integration contract. Evidence: `package.json:36-92`, `core/src/config/manager.ts:33`
- Never import from `@jovaltus/core` without first adding it to `package.json` dependencies — currently the extension declares `@jovaltus/core` as a `workspace:*` devDependency. Evidence: `package.json:101`
- The extension message protocol now supports 7 event types (`assistantMessage`, `phaseStart`, `phaseEnd`, `streamDelta`, `toolCall`, `agentError`, `agentComplete`) — changes to `AgentModeEvent` in core must be mirrored here. Evidence: `chat-panel.ts:187-226`
- `VSCodeConfigProvider` implements `ConfigProvider` with dotted-key convention matching core's `JovaltusConfig` structure — the dotted-key convention forms the integration contract. Evidence: `chat-panel.ts:356-365`
- Never remove `.js` extensions from relative imports — NodeNext ESM. Evidence: `tsconfig.base.json:13`
