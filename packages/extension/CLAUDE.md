# jovaltus — VS Code Extension

VS Code extension providing the Jovaltus chat sidebar panel and bridging VS Code configuration to the core engine. Activates lazily on view open.

# MODULE FILE LIST

- `src/extension.ts` — `activate()` + `deactivate()` — registers ChatPanelProvider for `jovaltus.chatPanel`
- `src/chat-panel.ts` — `ChatPanelProvider` (implements `WebviewViewProvider`) + `getWebviewHtml()` — inline HTML/CSS/JS chat UI

# RULES SHOULD NOT BE VIOLATED

- Never import VS Code types outside of `@types/vscode` — the extension must stay within the VS Code API surface. Evidence: `package.json:7` (`engines.vscode: "^1.95.0"`)
- The extension is the **consumer** of `@jovaltus/core` — core must never depend on extension. Evidence: `packages/core/package.json` has zero extension dependencies
- Never add local resources to the webview without updating `localResourceRoots` and adding a Content-Security-Policy. Evidence: `chat-panel.ts:162` sets `localResourceRoots: []` — currently no local assets
- Never change the view ID `jovaltus.chatPanel` without updating `activationEvents` in `package.json:11` — the lazy activation trigger depends on it. Evidence: `package.json:10-12`
- Configuration property keys under `jovaltus.*` must match the keys expected by core's `ConfigManager` — the dotted-key convention forms the integration contract. Evidence: `package.json:36-92`, `core/src/config/manager.ts:33`
- Never import from `@jovaltus/core` without first adding it to `package.json` dependencies — currently the extension has no core dependency. Evidence: `package.json` has no `dependencies` field, only `devDependencies`
- Never remove `.js` extensions from relative imports — NodeNext ESM. Evidence: `tsconfig.base.json:13`
