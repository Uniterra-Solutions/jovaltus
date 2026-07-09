# 命名慣例 (Naming Conventions)

來源：`packages/core/src/`、`packages/extension/src/` 全體原始碼

## 檔案命名

所有原始碼檔案採用 **kebab-case**（小寫連字號）命名。

**理由**：與 Node.js 生態系的慣例一致，避免跨平台檔案系統大小寫敏感問題。

**範例**：

- `tool-registry.ts` — ToolRegistry 類別的定義檔案
- `openai-provider.ts` — OpenAI 模型提供者
- `context-window.ts` — 上下文視窗解析邏輯
- `restrict-directory.ts` — 目錄限制守衛
- `chat-panel.ts` — VS Code 聊天面板提供者
- `config-provider.ts` — VS Code 配置橋接
- `chat-adapter.ts` — assistant-ui adapter

測試檔案以 `.test.ts` 後綴命名，置於 `src/__tests__/` 目錄下，與原始碼共置（colocated）。

## 型別與介面命名

介面與型別別名使用 **PascalCase**，不使用 `I` 前綴。

**理由**：TypeScript 官方風格指南建議不添加型別前綴。`readonly` 修飾詞已清晰表達合約意圖。

**範例**：

- `JovaltusConfig` — 系統配置介面（`config/types.ts:12`）
- `ModelClient` — 模型客戶端介面（`model/client.ts:6`）
- `AgentRole` — 代理角色型別別名（`agent/types.ts:4`）
- `ModelErrorCode` — 錯誤碼聯合型別（`model/errors.ts:1`）
- `ConfigProvider` — 配置提供者抽象介面（`config/types.ts:19`）

所有介面屬性均標記為 `readonly`，確保配置物件的不變性。

## 類別命名

類別使用 **PascalCase**，常用後綴表達語義：

- `Provider` — 模型提供者封裝或配置橋接：`OpenAIProvider`、`AnthropicProvider`、`ChatPanelProvider`、`VSCodeConfigProvider`
- `Manager` — 資源與配置管理：`ConfigManager`、`CleanDiffManager`、`WorktreeManager`
- `Orchestrator` — 多階段流水線編排：`AgentModeOrchestrator`
- `Registry` — 資源註冊表：`ToolRegistry`
- `Core` — 純邏輯核心：`PlannerCore`
- `Secrets` — 安全儲存操作：`JovaltusSecrets`
- `Error` — 自訂錯誤：`ModelError`、`DiffError`、`WorktreeError`、`PlannerError`

**理由**：後綴提供即時的語義提示，降低閱讀程式碼時的理解成本。

## 函式命名

函式使用 **camelCase**。工廠函式使用 `create` 前綴。

**理由**：`create` 前綴明確表達該函式用於建構新實例，與 JavaScript 慣例一致。

**範例**：

- `createAgent()` — 建立代理實例（`agent/factory.ts:98`）
- `createModelClient()` — 建立模型客戶端（`model/client.ts:13`）
- `createModelRegistry()` — 建立模型註冊表（`agent/factory.ts:66`）
- `resolveContextWindow()` — 解析上下文視窗（`config/context-window.ts:32`）
- `restrictToDirectory()` — 建立目錄限制守衛（`agent/restrict-directory.ts:19`）

## 常數命名

基礎型別常數使用 **UPPER_SNAKE_CASE**：

**範例**：

- `DEFAULT_CONTEXT_WINDOW` — 預設上下文視窗大小（`config/context-window.ts`）
- `MAX_BYTES` — 輸出位元組上限（`agent/tools/bash.ts`）
- `PATH_KEYS` — 路徑參數鍵名集合（`agent/restrict-directory.ts:4`）

工具物件常數使用 **camelCase** 命名（如同函式）：

**範例**：

- `readTool`、`writeTool`、`editTool`、`bashTool`

唯讀陣列常數使用 **UPPER_SNAKE_CASE**：

**範例**：

- `READ_ONLY_TOOLS`、`READ_WRITE_TOOLS`、`VERIFY_TOOLS`（`agent/tools/index.ts:7-9`）

## 私有成員命名

私有欄位不使用底線前綴，直接使用 `private readonly` 宣告。

**範例**：

- `private readonly tools = new Map()`（`tool-registry.ts:4`）
- `private readonly provider: ConfigProvider`（`config/manager.ts:10`）
- `private controller: AbortController | null = null`（`model/anthropic-provider.ts:9`）

未使用的函式參數以底線前綴 `_` 標記（如 `_id`），符合 ESLint 配置 `argsIgnorePattern: '^_'`（`eslint.config.mjs:24`）。
