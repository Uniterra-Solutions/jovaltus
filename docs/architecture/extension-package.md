# 擴充套件（Extension Package）設計原則

來源：`packages/extension/src/extension.ts`、`packages/extension/src/chat-panel.ts`、`packages/extension/src/webview/`

## 啟動策略

擴充套件採用延遲啟動（lazy activation），僅在使用者首次開啟 Jovaltus 側邊欄視圖時觸發 `activate()`。啟動後建立 `JovaltusSecrets`、`VSCodeConfigProvider` 與 `ChatPanelProvider`，並將其生命週期綁定至 VS Code 的 `context.subscriptions`，確保擴充套件停用時自動清理。同時觸發 `secrets.migrateFromConfig()` 進行非同步一次性 API key 遷移。

## 通訊協議

主機（extension host）與 webview 之間透過結構化 postMessage 進行雙向通訊：

- **Webview → Host**：
  - `userMessage` —— 使用者發送訊息（`{ type, text }`）
  - `modelSwitch` —— 模型切換（`{ type, modelId }`）
- **Host → Webview**：
  - `assistantMessage` —— 完整助理訊息（`{ type, text }`）
  - `phaseStart` —— 階段開始（`{ type, phase, text }`）
  - `phaseEnd` —— 階段結束（`{ type, phase, status, text }`）
  - `streamDelta` —— 串流文字增量（`{ type, phase, text }`）
  - `toolCall` —— 工具呼叫通知（`{ type, phase, toolName, args }`）
  - `agentError` —— 代理錯誤（`{ type, phase, text }`）
  - `agentComplete` —— 流水線完成摘要（`{ type, summary }`）

來源：`packages/extension/src/webview/vscode-bridge.ts:1-8`（webview 訊息類型定義）、`packages/extension/src/chat-panel.ts:43-51`（host 端訊息處理）、`packages/extension/src/chat-panel.ts:93-117`（host 端事件映射）

## Webview 架構

Webview 使用 **React + assistant-ui**，由 **Vite** 打包輸出至 `dist/webview/`：

- **建置管線**：webview source（`src/webview/`）由 Vite 獨立打包，extension host source 由 `tsc -b` 編譯。兩者透過 `tsconfig.json` 的 `exclude` 設定隔離
- **執行環境**：`enableScripts: true`，`localResourceRoots` 指向 `dist/webview/` 目錄
- **Content-Security-Policy**：`loadWebviewHtml()` 注入 CSP meta 標籤（`default-src 'none'`），限制 script/src、style/src 與 connect、font、img 來源
- **主題適應**：所有顏色引用 VS Code CSS 自訂屬性（`--vscode-*`），不使用 Tailwind CSS
- **執行期整合**：assistant-ui 的 `useLocalRuntime` + `ChatModelAdapter` 橋接 postMessage 事件流。`chat-adapter.ts` 將 extension host 的 `AgentModeEvent` 轉換為 assistant-ui 的 async generator content chunks。模型列表與預設值透過 `<meta name="jovaltus-init">` 注入 HTML，webview 啟動時由 `init-models.ts` 解析，無需額外訊息往返

### Webview 組件結構

- `App.tsx` — Root：`useLocalRuntime` + `AssistantRuntimeProvider` + 模型選擇狀態（從 `<meta name="jovaltus-init">` 讀取）（`packages/extension/src/webview/App.tsx:1-31`）
- `ChatView.tsx` — 主對話視圖：`ThreadPrimitive` + `ComposerPrimitive` + `MessagePrimitive` + `MarkdownTextPrimitive`（`packages/extension/src/webview/components/ChatView.tsx:1-104`）
- `ToolCallDisplay.tsx` — 可折疊工具呼叫卡片（名稱、參數、結果、錯誤狀態）
- `ModelSelector.tsx` — 模型下拉選單（`packages/extension/src/webview/components/ModelSelector.tsx:1-30`）
- `init-models.ts` — 純邏輯 parser：從 host 注入的 `<meta name="jovaltus-init">` 讀取模型列表與預設值，定義 `ModelOption`、`InitModels` 型別與 `parseInitMeta()` 函式（`packages/extension/src/webview/init-models.ts:1-48`）
- `chat-adapter.ts` — `ChatModelAdapter`：將 postMessage 事件轉換為 async generator yields（`packages/extension/src/webview/chat-adapter.ts:1-87`）
- `vscode-bridge.ts` — Promise-based event queue：將 postMessage callback 轉換為 AsyncIterable（`packages/extension/src/webview/vscode-bridge.ts:1-58`）

## 配置貢獻

擴充套件向 VS Code 貢獻 9 個配置屬性，以單一 provider 為核心：

- Provider 選擇：`jovaltus.provider`（enum: `anthropic` | `openai`，預設 `anthropic`）
- 提供者端點：`jovaltus.baseUrl`（預設空字串，留空時依所選 provider 使用官方端點）、`jovaltus.apiKey`
- 協調者模型設定：`jovaltus.coordinatorModel.modelId`、`contextWindow`、`maxTokens`
- 工作者模型設定：`jovaltus.workerModel.modelId`、`contextWindow`、`maxTokens`

設定項透過 `order` 欄位排序：provider → baseUrl → apiKey → coordinator 模型 → worker 模型。API key 設定項保留在 VS Code config 中以支援向後相容，但讀取時優先使用 `SecretStorage`（`secrets.ts`）。`VSCodeConfigProvider` 接收預載入的 secret key Map，以同步方式提供給 core 的 `ConfigManager`。

## 與核心套件的介面

擴充套件已引入 `@jovaltus/core` 作為 workspace 依賴。`ChatPanelProvider.handleUserMessage()` 建立如下整合路徑：

1. **配置橋接**：`VSCodeConfigProvider` 實作 `ConfigProvider` 介面，將 VS Code 配置 API + SecretStorage 橋接至 core 的 `ConfigManager`。`modelSwitch` 訊息使用 `ConfigManager` 的 overrides 機制（`DeepPartial<JovaltusConfig>`）覆蓋模型選擇
2. **Orchestrator 建立**：`new AgentModeOrchestrator({ repoPath, config })` 使用工作區根目錄與已解析的配置
3. **事件串流**：`orchestrator.onEvent(callback)` 將 `AgentModeEvent` 類型映射至 webview postMessage 協議。`forwardEvent()` 處理六種事件類型（`phase_start`、`phase_end`、`stream_delta`、`tool_call`、`tool_result`、`error`），其中 `tool_result` 被忽略不轉發
4. **流水線執行**：`orchestrator.run(task)` 執行完整的四階段流水線，將最終摘要回傳至 webview
5. **模型切換**：webview 發送 `modelSwitch` 訊息 → host 儲存選擇的模型 ID → 下次 `run()` 使用 `ConfigManager` overrides 套用新模型
6. **模型列表注入**：`resolveWebviewView()` 呼叫 `buildModelOptions()` 從 config 產生 dedup 模型列表（coordinator + worker），透過 `injectInitMeta()` 寫入 `<meta name="jovaltus-init">`，webview 的 `parseInitMeta()` 解析後驅動下拉選單。來源：`packages/extension/src/chat-panel.ts:52-97`
