# 配置 (Configuration)

## 協調者模型設定

- **Given** 使用者希望自訂協調者代理所使用的模型
- **When** 使用者在 VS Code 設定（Settings UI 或 settings.json）中修改 `jovaltus.coordinatorModel` 下的 `modelId`、`contextWindow`、`maxTokens`
- **Then** 系統使用指定的模型 ID（預設 `claude-sonnet-4-5`）、上下文視窗大小（預設 `auto` 自動偵測）、與最大輸出 token 數（預設 4096）來建立協調者代理

## 工作者模型設定

- **Given** 使用者希望自訂工作者代理所使用的模型
- **When** 使用者在 VS Code 設定中修改 `jovaltus.workerModel` 下的 `modelId`、`contextWindow`、`maxTokens`
- **Then** 系統使用指定的模型 ID（預設 `claude-haiku-4-5`）、上下文視窗大小（預設 `auto` 自動偵測）、與最大輸出 token 數（預設 4096）來建立工作者代理

## OpenAI 提供者設定

- **Given** 使用者需要使用自託管的 OpenAI 相容 API 端點
- **When** 使用者在設定中修改 `jovaltus.openai.baseUrl`
- **Then** 系統使用指定的端點位址（預設 `https://api.openai.com/v1`）進行 OpenAI 協議的模型請求。API key 優先從 `SecretStorage` 讀取，若不存在則 fallback 至 VS Code 設定的 `jovaltus.openai.apiKey`

## Anthropic 提供者設定

- **Given** 使用者需要使用自託管的 Anthropic 相容 API 端點
- **When** 使用者在設定中修改 `jovaltus.anthropic.baseUrl`
- **Then** 系統使用指定的端點位址（預設 `https://api.anthropic.com`）進行 Anthropic 協議的模型請求。API key 優先從 `SecretStorage` 讀取，若不存在則 fallback 至 VS Code 設定的 `jovaltus.anthropic.apiKey`

## API Key SecretStorage

- **Given** 使用者已在 VS Code 設定中設置了 API key（`jovaltus.openai.apiKey` 或 `jovaltus.anthropic.apiKey`）
- **When** 擴充套件首次啟動
- **Then** 系統自動將 plaintext 設定中的 API key 遷移至 VS Code `SecretStorage`（`secrets.ts:16-22`），並清除原始設定值。後續擴充套件啟動時 eager 載入 SecretStorage 中的 key 至 `Map<string, string>`，透過 `VSCodeConfigProvider` 以同步方式提供給 core 的 `ConfigManager`

## 模型切換（Agent Mode）

- **Given** 使用者正在使用 Agent Mode 對話
- **When** 使用者從模型下拉選單中選擇新模型
- **Then** webview 發送 `modelSwitch` 訊息至 extension host，extension host 儲存選擇的 modelId，下一個對話請求使用 `ConfigManager` 的 `DeepPartial<JovaltusConfig>` overrides 同時覆蓋 coordinatorModel 和 workerModel 的 modelId

## 上下文視窗自動偵測

- **Given** 模型配置的 `contextWindow` 設為 `auto`
- **When** 系統需要解析模型的實際上下文視窗大小
- **Then** 系統查詢提供者的 `/models` 端點以獲取模型的 `context_window`／`context_length`／`max_input_tokens` 欄位值；若查詢失敗則使用預設值 200,000 tokens

## 設定優先順序

- **Given** 同一項配置存在多個來源（程式覆寫、VS Code 設定、預設值）
- **When** 系統解析最終配置值
- **Then** 程式覆寫優先於 VS Code 設定，VS Code 設定優先於系統預設值
