# 程式碼風格 (Coding Style)

來源：`tsconfig.base.json`、`eslint.config.mjs`、`.prettierrc`，以及 `packages/core/src/`、`packages/extension/src/` 原始碼

## TypeScript 嚴格模式

專案啟用 TypeScript 最嚴格的型別檢查層級。

**理由**：在編譯期捕捉更多潛在錯誤，減少執行期意外行為。

**配置**（`tsconfig.base.json:4-9`）：

```json
"strict": true,
"noUncheckedIndexedAccess": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"forceConsistentCasingInFileNames": true
```

ESLint 層級附加規則（`eslint.config.mjs:29-35`）：

- `explicit-function-return-type: error` — 所有函式必須顯式標註回傳型別
- `no-explicit-any: error` — 禁止使用 `any` 型別
- `prefer-readonly: error` — 偏好 `readonly` 修飾詞
- `switch-exhaustiveness-check: error` — switch 必須窮盡所有情況
- `no-floating-promises: error` — 禁止未處理的 Promise

## 匯入順序

匯入語句按來源類型分組，順序為：Node 內建模組 → 外部套件 → 內部模組。

**理由**：結構化的匯入順序提高可讀性，讓相依關係一目瞭然。

**範例**（`agent/factory.ts:1-13`）：

```typescript
import { createModels, createProvider } from '@earendil-works/pi-ai';
import { Agent } from '@earendil-works/pi-agent-core';

import type { JovaltusConfig, ModelConfig } from '../config/types.js';
import type { CreateAgentOptions } from './types.js';
```

型別匯入使用 `import type` 關鍵字以確保編譯後不產生執行期依賴。

## 匯出慣例

- 所有匯出均為**命名匯出**（named exports），不使用 default export
- Barrel 檔案（`index.ts`）中的每個符號均**顯式列出**，不使用 `export * from`
- 型別與值的匯出分開宣告：`export type { ... }` 與 `export { ... }` 分開

**理由**：顯式匯出讓公共 API 合約清晰可見，避免內部實作細節意外洩漏。

**範例**（`agent/index.ts:1-13`）：

```typescript
export type { AgentRole, AgentContext, CreateAgentOptions } from './types.js';
export { createAgent, createModelRegistry } from './factory.js';
export { ToolRegistry } from './tool-registry.js';
export { restrictToDirectory } from './restrict-directory.js';
export { readTool, writeTool, editTool, bashTool, ... } from './tools/index.js';
```

## 模組解析

使用 NodeNext 模組解析，內部匯入必須使用 `.js` 副檔名。

**理由**：NodeNext 模組解析是 ESM 的原生解析策略，`.js` 副檔名確保編譯後的 JS 檔案可被 Node.js 直接載入。

**範例**：

```typescript
import { ConfigManager } from './manager.js'; // ✅ .js 副檔名
```

## 註釋風格

使用區段分隔線標記檔案的邏輯分區。

**範例**：

```typescript
// ── Helpers ──────────────────────────────────────────────────────────
// ── Public API ───────────────────────────────────────────────────────
```

內聯註釋稀少且僅用於解釋非顯而易見的行為，不重複程式碼已經表達的資訊。

## 類別使用時機

偏好函式與純物件而非類別。僅在需要管理可變狀態時使用類別。

**使用類別的場合**：

- 管理 AbortController 生命週期（`OpenAIProvider`、`AnthropicProvider`）
- 封裝配置解析狀態（`ConfigManager`）
- 管理動態工具註冊表（`ToolRegistry`）
- 實現 WebviewViewProvider 介面（`ChatPanelProvider`）
- 封裝 SecretStorage 操作（`JovaltusSecrets`）
- 橋接配置 API（`VSCodeConfigProvider`）
- 自訂錯誤型別（`ModelError`、`DiffError`、`WorktreeError`、`PlannerError`）
