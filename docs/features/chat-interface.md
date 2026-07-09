# 聊天介面 (Chat Interface)

來源：`packages/extension/src/chat-panel.ts:6-231`

## 基本聊天互動

- **Given** 使用者已開啟 VS Code 且有 Jovaltus 擴充套件已啟用
- **When** 使用者在活動列點擊 Jovaltus 圖示
- **Then** 側邊欄顯示 Jovaltus Chat 面板，包含歡迎訊息與對話輸入區

## 發送訊息

- **Given** 聊天面板已開啟
- **When** 使用者在輸入框中輸入文字並按下 Enter 鍵或點擊 Send 按鈕
- **Then** 訊息顯示在對話區域中（使用者訊息靠右對齊、淺色背景），輸入框自動清空，任務交由 Agent Mode Orchestrator 執行

## 代理模式流水線狀態顯示

- **Given** Agent Mode Orchestrator 正在執行四階段流水線
- **When** 每個階段開始、結束或發生錯誤
- **Then** 聊天面板顯示對應的系統訊息：
  - 階段開始：`[Phase] <phase>: <label>`（`chat-panel.ts:193-194`）
  - 階段結束：`[Phase] <phase>: completed/failed — <summary>`，失敗時以錯誤樣式顯示（`chat-panel.ts:197-203`）
  - 階段標籤對應：`implementation` → "Implementing changes"、`planning` → "Distilling & planning"、`verification` → "Verifying & fixing"、`simplification` → "Simplifying code"（`chat-panel.ts:342-350`）

## 串流輸出

- **Given** 代理正在生成回應
- **When** 模型逐 token 輸出文字
- **Then** 文字透過 `streamDelta` 事件即時追加至對話氣泡中。串流氣泡在收到 `assistantMessage`、`phaseStart` 或 `toolCall` 後重置，為下一個輸出建立新氣泡（`chat-panel.ts:147-169`）

## 工具呼叫顯示

- **Given** 代理呼叫工具（如 read、write、bash）
- **When** 工具呼叫開始
- **Then** 聊天面板顯示 `[Tool] <phase> → <toolName>` 系統訊息（`chat-panel.ts:213-215`）

## 錯誤顯示

- **Given** 階段執行失敗或發生致命錯誤
- **When** 錯誤事件觸發
- **Then** 錯誤訊息以紅色邊框和背景顯示在對話區域中央（`chat-panel.ts:76-82`）

## 任務完成摘要

- **Given** 代理模式流水線完成（成功或部分失敗）
- **When** `orchestrator.run()` 回傳 `AgentModeResult`
- **Then** 聊天面板顯示 `finalSummary` 的格式化摘要，包含各階段狀態 ❌/✅ 指示器及通過率統計（`chat-panel.ts:223-225`）

## 主題適應

- **Given** 使用者已切換 VS Code 主題（淺色／深色）
- **When** 聊天面板渲染
- **Then** 對話介面的背景、文字、輸入框、按鈕顏色自動與當前 VS Code 主題保持一致

## 對話捲動

- **Given** 對話區域內的訊息超過可視範圍
- **When** 新訊息加入
- **Then** 對話區域自動捲動至最新訊息底部
