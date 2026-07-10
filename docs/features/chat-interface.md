# 聊天介面 (Chat Interface)

來源：`packages/extension/src/chat-panel.ts`、`packages/extension/src/webview/`

## 基本聊天互動

- **Given** 使用者已開啟 VS Code 且有 Jovaltus 擴充套件已啟用
- **When** 使用者在活動列點擊 Jovaltus 圖示
- **Then** 側邊欄顯示 Jovaltus Chat 面板，包含歡迎訊息、模型選擇器與對話輸入區。介面使用 React + assistant-ui 渲染，由 Vite 打包（`vite.config.ts`）

## 發送訊息

- **Given** 聊天面板已開啟
- **When** 使用者在輸入框中輸入文字並按下 Enter 鍵或點擊 Send 按鈕
- **Then** assistant-ui `ComposerPrimitive` 觸發提交，`ChatModelAdapter.run()` 透過 `vscode-bridge.ts` 的 postMessage 將 `userMessage` 發送至 extension host，觸發 `AgentModeOrchestrator.run()`

## 串流輸出

- **Given** 代理正在生成回應
- **When** 模型逐 token 輸出文字
- **Then** extension host 透過 `streamDelta` postMessage 事件轉發文字，webview 的 `chat-adapter.ts` 將事件累積並透過 async generator yield 給 assistant-ui runtime，`MarkdownTextPrimitive`（來自 `@assistant-ui/react-markdown`）以平滑動畫即時顯示，支援 markdown 格式、程式碼高亮、表格、引用等

## 工具呼叫顯示

- **Given** 代理呼叫工具（如 read、write、bash）
- **When** 工具呼叫開始
- **Then** extension host 轉發包含 `toolName` 與 `args` 的 `toolCall` 事件，webview 的 `chat-adapter.ts` 建立 tool-call content part，assistant-ui 以 `ToolCallDisplay` 卡片顯示：工具名稱、可折疊的參數（JSON 格式）與執行結果、狀態指示器（執行中／完成／錯誤）

## 錯誤顯示

- **Given** 階段執行失敗或發生致命錯誤
- **When** `agentError` postMessage 事件觸發
- **Then** adapter 將錯誤轉換為 assistant-ui 的 incomplete status 訊息，以紅色邊框和背景顯示

## 任務完成摘要

- **Given** 代理模式流水線完成（成功或部分失敗）
- **When** `orchestrator.run()` 回傳 `AgentModeResult`
- **Then** extension host 發送 `agentComplete` postMessage，adapter yield 最終摘要，assistant-ui 顯示完整結果

## 階段狀態顯示

- **Given** Agent Mode Orchestrator 正在執行四階段流水線
- **When** 每個階段開始或結束
- **Then** extension host 發送 `phaseStart`／`phaseEnd` postMessage 事件，webview 以文字形式顯示階段轉換：
  - 階段標籤對應：`implementation` → "Implementing changes"、`planning` → "Distilling & planning"、`verification` → "Verifying & fixing"、`simplification` → "Simplifying code"

## 模型選擇

- **Given** 聊天面板已開啟
- **When** 面板初始化
- **Then** extension host 從使用者設定讀取 coordinator 與 worker 的 model ID，透過 `<meta name="jovaltus-init">` 注入 webview HTML（`chat-panel.ts:52-97`）。webview 的 `init-models.ts` 解析該 meta 標籤取得模型列表與預設值（`init-models.ts:27-48`），`App.tsx` 驅動 `ModelSelector` 下拉選單顯示這些模型。預設選取 coordinator 模型

- **Given** 使用者點擊頂部模型下拉選單
- **When** 使用者在聊天介面中選擇不同模型
- **Then** 發送 `modelSwitch` 訊息至 extension host，下一個對話請求將使用新模型

## 主題適應

- **Given** 使用者已切換 VS Code 主題（淺色／深色）
- **When** 聊天面板渲染
- **Then** 對話介面所有顏色透過 VS Code CSS custom properties（`--vscode-*`）自動與當前主題保持一致

## 對話捲動

- **Given** 對話區域內的訊息超過可視範圍
- **When** 新訊息加入
- **Then** assistant-ui `ThreadPrimitive.Viewport` 自動捲動至最新訊息底部

## 安全性：Content-Security-Policy

- **Given** webview 內容已載入
- **When** `loadWebviewHtml()` 產生 HTML
- **Then** 注入 CSP meta 標籤，限制 script-src 與 connect-src 僅允許 VS Code webview 來源，防止未授權的資源載入
