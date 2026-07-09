# 擴充套件（Extension Package）設計原則

來源：`packages/extension/src/extension.ts:4-10`、`packages/extension/src/chat-panel.ts:233-365`

## 啟動策略

擴充套件採用延遲啟動（lazy activation），僅在使用者首次開啟 Jovaltus 側邊欄視圖時觸發 `activate()`。啟動後註冊單一 `ChatPanelProvider` 作為 `jovaltus.chatPanel` 視圖的 webview 提供者，並將其生命週期綁定至 VS Code 的 `context.subscriptions`，確保擴充套件停用時自動清理。

## 通訊協議

主機（extension host）與 webview 之間透過六種結構化訊息類型的判別聯合進行雙向通訊：

- **Webview → Host**：`vscode.postMessage({ type: 'userMessage', text })`
- **Host → Webview**：
  - `assistantMessage` —— 完整助理訊息（`{ type, text }`）
  - `phaseStart` —— 階段開始（`{ type, phase, text }`）
  - `phaseEnd` —— 階段結束（`{ type, phase, status, text }`）
  - `streamDelta` —— 串流文字增量（`{ type, phase, text }`）
  - `toolCall` —— 工具呼叫通知（`{ type, phase, toolName }`）
  - `agentError` —— 代理錯誤（`{ type, phase, text }`）
  - `agentComplete` —— 流水線完成摘要（`{ type, summary }`）

來源：`packages/extension/src/chat-panel.ts:187-226`（webview 端訊息處理）、`packages/extension/src/chat-panel.ts:276-329`（host 端事件映射）

## Webview 架構

Webview 內容由 `getWebviewHtml()` 以靜態內嵌方式產生，無外部資源依賴。設計考量：

- **Script 啟用**：`enableScripts: true`，支援內嵌 JavaScript 邏輯
- **無本地資源存取**：`localResourceRoots: []`，webview 無法存取本地檔案系統
- **主題適應**：所有顏色引用 VS Code CSS 自訂屬性（`--vscode-*`）並別名為 `--jovaltus-*` 區域變數，確保自動跟隨 VS Code 主題變化

## 配置貢獻

擴充套件向 VS Code 貢獻 10 個配置屬性，分為三組：

- 協調者模型設定：`jovaltus.coordinatorModel.modelId`、`contextWindow`、`maxTokens`
- 工作者模型設定：`jovaltus.workerModel.modelId`、`contextWindow`、`maxTokens`
- 提供者設定：OpenAI（`baseUrl`、`apiKey`）與 Anthropic（`baseUrl`、`apiKey`）

這些配置屬性對應核心套件的 `JovaltusConfig` 類型結構，形成擴充套件與核心之間的配置合約。

## 與核心套件的介面

擴充套件已引入 `@jovaltus/core` 作為 workspace 依賴（`package.json` devDependencies）。`ChatPanelProvider.handleUserMessage()` 建立如下整合路徑（`chat-panel.ts:247-350`）：

1. **配置橋接**：`VSCodeConfigProvider` 實作 `ConfigProvider` 介面，將 VS Code 配置 API（`workspace.getConfiguration`）橋接至核心的 `ConfigManager`。透過 `configManager.getConfig()` 取得完整的 `JovaltusConfig`。來源：`chat-panel.ts:356-365`
2. **Orchestrator 建立**：`new AgentModeOrchestrator({ repoPath, config })` 使用工作區根目錄與已解析的配置。來源：`chat-panel.ts:266-269`
3. **事件串流**：`orchestrator.onEvent(callback)` 將六種 `AgentModeEvent` 類型映射至 webview 訊息協議，將核心的可觀察事件橋接至聊天面板 UI。來源：`chat-panel.ts:276-323`
4. **流水線執行**：`orchestrator.run(task)` 執行完整的四階段流水線，將最終摘要回傳至 webview。來源：`chat-panel.ts:326-337`

Webview 端的 JavaScript 維護一個**串流氣泡**：`streamDelta` 訊息會追加至當前氣泡，直到收到 `assistantMessage`、`phaseStart` 或 `toolCall` 等非串流事件後重置（`chat-panel.ts:147-168`）。此設計讓長篇代理輸出可以逐 token 渲染，而非等待完成後一次性顯示。
