# 配置 (Configuration)

## Provider 選擇

- **Given** 使用者希望選擇 API 提供者
- **When** 使用者在 VS Code 設定（Settings UI 或 settings.json）中修改 `jovaltus.provider`
- **Then** 系統使用指定的提供者協議（`anthropic` 或 `openai`，預設 `anthropic`）進行所有模型請求。下拉選單顯示為 "Anthropic-compatible API" 與 "OpenAI-compatible API"。來源：`packages/extension/package.json:36-49`、`packages/core/src/config/manager.ts:19-20`

## 提供者端點與 API Key

- **Given** 使用者需要使用自託管的 API 端點
- **When** 使用者在設定中修改 `jovaltus.baseUrl`
- **Then** 系統使用指定的端點位址；若留空則依所選 provider 使用預設端點（OpenAI: `https://api.openai.com/v1`，Anthropic: `https://api.anthropic.com`）。來源：`packages/core/src/config/manager.ts:22-24`、`packages/core/src/config/defaults.ts:4-7`

- **Given** 使用者需要設定 API key
- **When** 使用者在設定中修改 `jovaltus.apiKey`
- **Then** API key 優先從 `SecretStorage` 讀取，若不存在則 fallback 至 VS Code 設定的 `jovaltus.apiKey`。擴充套件啟動時自動將 plaintext 設定中的 API key 遷移至 VS Code `SecretStorage`（`secrets.ts:11-19`），並清除原始設定值。後續啟動時 eager 載入 SecretStorage 中的 key，透過 `VSCodeConfigProvider` 以同步方式提供給 core 的 `ConfigManager`。來源：`packages/extension/src/secrets.ts:1-20`、`packages/extension/src/extension.ts:12-14`

## 協調者模型設定

- **Given** 使用者希望自訂協調者代理所使用的模型
- **When** 使用者在 VS Code 設定（Settings UI 或 settings.json）中修改 `jovaltus.coordinatorModel` 下的 `modelId`、`contextWindow`、`maxTokens`
- **Then** 系統使用指定的模型 ID（預設 `claude-sonnet-4-5`）、上下文視窗大小（預設 `auto` 自動偵測）、與最大輸出 token 數（預設 4096）來建立協調者代理

## 工作者模型設定

- **Given** 使用者希望自訂工作者代理所使用的模型
- **When** 使用者在 VS Code 設定中修改 `jovaltus.workerModel` 下的 `modelId`、`contextWindow`、`maxTokens`
- **Then** 系統使用指定的模型 ID（預設 `claude-haiku-4-5`）、上下文視窗大小（預設 `auto` 自動偵測）、與最大輸出 token 數（預設 4096）來建立工作者代理

## 模型切換（Agent Mode）

- **Given** 使用者正在使用 Agent Mode 對話
- **When** 使用者從模型下拉選單中選擇新模型
- **Then** webview 發送 `modelSwitch` 訊息至 extension host，extension host 儲存選擇的 modelId，下一個對話請求使用 `ConfigManager` 的 `DeepPartial<JovaltusConfig>` overrides 同時覆蓋 coordinatorModel 和 workerModel 的 modelId。模型下拉選單的內容來自主機注入的 `<meta name="jovaltus-init">` 標籤，包含使用者在設定中配置的 coordinator 與 worker 模型（去重），預設選取 coordinator 模型。來源：`packages/extension/src/chat-panel.ts:52-97`、`packages/extension/src/webview/init-models.ts:27-48`

## 上下文視窗自動偵測

- **Given** 模型配置的 `contextWindow` 設為 `auto`
- **When** 系統需要解析模型的實際上下文視窗大小
- **Then** 系統查詢提供者的 `/models` 端點以獲取模型的 `context_window`／`context_length`／`max_input_tokens` 欄位值；若查詢失敗則使用預設值 200,000 tokens

## 設定優先順序

- **Given** 同一項配置存在多個來源（程式覆寫、VS Code 設定、預設值）
- **When** 系統解析最終配置值
- **Then** 程式覆寫優先於 VS Code 設定，VS Code 設定優先於系統預設值
