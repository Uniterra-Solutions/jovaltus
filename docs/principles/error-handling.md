# 錯誤處理 (Error Handling)

來源：`packages/core/src/model/errors.ts:1-50`、`packages/core/src/model/anthropic-provider.ts:65-87`、`packages/core/src/model/openai-provider.ts:62-84`

## 錯誤模型統一化

所有模型相關錯誤透過單一 `ModelError` 類別統一表示。

**理由**：不同 LLM 提供者（OpenAI、Anthropic）各自的 SDK 拋出不同型別的例外。統一的錯誤模型讓呼叫方能以一致的方式處理錯誤，無需關心底層提供者差異。

`ModelError`（`model/errors.ts:4-23`）包含以下欄位：

- `code`：錯誤碼（6 種分類）
- `provider`：提供者名稱（`'openai'` 或 `'anthropic'`）
- `statusCode`（可選）：HTTP 狀態碼
- `retryAfterMs`（可選）：建議重試等待時間（毫秒）

## 錯誤碼分類

系統定義 6 種標準錯誤碼（`model/errors.ts:1-2`）：

| 錯誤碼          | 含義           | 觸發條件                                     |
| --------------- | -------------- | -------------------------------------------- |
| AUTH_ERROR      | 認證失敗       | HTTP 401 或 403                              |
| TIMEOUT         | 請求逾時       | AbortError 或 timeout 關鍵字                 |
| RATE_LIMIT      | 請求頻率限制   | HTTP 429                                     |
| INVALID_REQUEST | 請求格式錯誤   | HTTP 400                                     |
| PROVIDER_ERROR  | 提供者內部錯誤 | 其他 HTTP 錯誤狀態碼或未分類錯誤             |
| NETWORK_ERROR   | 網路連線錯誤   | fetch failed、ECONNREFUSED、ENOTFOUND 等訊息 |

## HTTP 狀態碼對映

`statusToCode()`（`model/errors.ts:25-30`）將 HTTP 狀態碼對映至錯誤碼：

- 401/403 → AUTH_ERROR
- 429 → RATE_LIMIT
- 400 → INVALID_REQUEST
- 其他 → PROVIDER_ERROR

## 原生錯誤分類

`classifyError()`（`model/errors.ts:38-50`）處理非 HTTP 層級的錯誤，透過檢查錯誤名稱與訊息中的關鍵字進行分類：

- timeout / timed out / TimeoutError → TIMEOUT
- fetch failed / network / ECONNREFUSED / ENOTFOUND → NETWORK_ERROR
- 其他 → PROVIDER_ERROR

## 提供者錯誤對映

每個提供者（OpenAIProvider、AnthropicProvider）透過相同的三層分類邏輯處理 SDK 例外（`model/openai-provider.ts:62-84`、`model/anthropic-provider.ts:65-87`）：

1. 若已經是 `ModelError`，直接傳遞
2. 若為提供者 SDK 的 `APIError`，提取 HTTP 狀態碼與 `retry-after` 標頭進行分類
3. 若為 `DOMException` 的 `AbortError`，歸類為 TIMEOUT
4. 其他情況，透過 `classifyError()` 進行啟發式分類

此一致的對映模式確保無論使用哪個提供者，錯誤處理邏輯保持統一。

## 工具執行中的錯誤

工具執行不拋出例外。所有結果（包含錯誤）均以結構化的 `AgentToolResult` 回傳：

- **Edit Tool**：比對失敗時回傳 `{ filePath, error: 'not_found' | 'ambiguous' }`（`agent/tools/edit.ts:42-51`）
- **Bash Tool**：執行失敗時回傳完整的 stdout/stderr 與 exit code，不拋出例外（`agent/tools/bash.ts:28-36`）
