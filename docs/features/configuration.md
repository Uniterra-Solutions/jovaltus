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
- **When** 使用者在設定中修改 `jovaltus.openai.baseUrl` 與 `jovaltus.openai.apiKey`
- **Then** 系統使用指定的端點位址（預設 `https://api.openai.com/v1`）與 API 金鑰進行 OpenAI 協議的模型請求

## Anthropic 提供者設定

- **Given** 使用者需要使用自託管的 Anthropic 相容 API 端點
- **When** 使用者在設定中修改 `jovaltus.anthropic.baseUrl` 與 `jovaltus.anthropic.apiKey`
- **Then** 系統使用指定的端點位址（預設 `https://api.anthropic.com`）與 API 金鑰進行 Anthropic 協議的模型請求

## 上下文視窗自動偵測

- **Given** 模型配置的 `contextWindow` 設為 `auto`
- **When** 系統需要解析模型的實際上下文視窗大小
- **Then** 系統查詢提供者的 `/models` 端點以獲取模型的 `context_window`／`context_length`／`max_input_tokens` 欄位值；若查詢失敗則使用預設值 200,000 tokens

## 設定優先順序

- **Given** 同一項配置存在多個來源（程式覆寫、VS Code 設定、預設值）
- **When** 系統解析最終配置值
- **Then** 程式覆寫優先於 VS Code 設定，VS Code 設定優先於系統預設值
