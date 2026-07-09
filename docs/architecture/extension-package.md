# 擴充套件（Extension Package）設計原則

來源：`packages/extension/src/extension.ts:4-10`、`packages/extension/src/chat-panel.ts:160-175`

## 啟動策略

擴充套件採用延遲啟動（lazy activation），僅在使用者首次開啟 Jovaltus 側邊欄視圖時觸發 `activate()`。啟動後註冊單一 `ChatPanelProvider` 作為 `jovaltus.chatPanel` 視圖的 webview 提供者，並將其生命週期綁定至 VS Code 的 `context.subscriptions`，確保擴充套件停用時自動清理。

## 通訊協議

主機（extension host）與 webview 之間透過結構化訊息協議進行雙向通訊：

- **Webview → Host**：使用 `vscode.postMessage({ type, text })`，訊息類型為 `userMessage`
- **Host → Webview**：使用 `webviewView.webview.postMessage({ type, text })`，訊息類型為 `assistantMessage`

訊息採用判別聯合（discriminated union）的 `{ type, text }` 格式，可擴展至更多事件類型（streaming 增量、工具呼叫事件、錯誤通知等）。

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

目前擴充套件尚未引入 `@jovaltus/core` 依賴（聊天面板僅實作 echo 迴響作為佔位）。預期的整合路徑為：擴充套件透過 `ConfigManager` 讀取 VS Code 設定並建構 `JovaltusConfig`，再呼叫 `createAgent` 建立代理實例，並將代理輸出串接回 webview。配置貢獻點已預先宣告了這條整合路徑的合約。
