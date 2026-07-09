# 工具系統（Tool System）設計原則

來源：`packages/core/src/agent/tools/index.ts:7-9`、`packages/core/src/agent/tool-registry.ts:3-21`、`packages/core/src/agent/restrict-directory.ts:6-36`

## 工具定義合約 (Tool Definition Contract)

每個工具是一個 `AgentTool` 物件，遵循以下結構合約：

- **`name`**：工具的唯一識別名稱，用於 ToolRegistry 索引與模型參照
- **`label`**：人類可讀的顯示名稱
- **`description`**：工具用途描述（面向 LLM，作為 function calling 的文件）
- **`parameters`**：使用 `@sinclair/typebox` 定義的參數 schema，支援 `Type.Object`、`Type.String`、`Type.Number`、`Type.Optional`、`Type.Boolean` 等型別
- **`execute`**：非同步執行函式，接收呼叫 ID、參數、AbortSignal，回傳 `AgentToolResult`

工具執行不回傳拋出例外：所有結果（包含錯誤狀況）均以結構化的 `AgentToolResult` 回傳，其中 `content` 陣列為面向 LLM 的文字描述，`details` 欄位為結構化的主機可用資訊。

## 能力分級預設組合 (Tool Presets)

系統預先定義三組工具集合作為能力層級：

| 預設組合         | 工具內容                   | 適用場景               |
| ---------------- | -------------------------- | ---------------------- |
| READ_ONLY_TOOLS  | read + bash                | 審查 agent、唯讀分析   |
| READ_WRITE_TOOLS | read + write + edit + bash | 開發實作 agent         |
| VERIFY_TOOLS     | bash                       | 驗證 agent、僅命令執行 |

能力分級讓不同角色的代理使用不同的工具組合（例如 reviewer 僅授予唯讀權限），從工具層面實現最小權限原則。

## 工具註冊表 (ToolRegistry)

`ToolRegistry` 是一個基於 `Map` 的記憶體內工具管理容器，提供以下操作：

- **`register(tool)`**：以工具名稱為鍵註冊工具
- **`list()`**：回傳所有已註冊工具的唯讀陣列
- **`select(names)`**：按名稱選取工具子集，未知名稱靜默跳過（不回報錯誤）
- **`get(name)`**：按名稱查找單一工具

註冊表的設計使工具集合可在執行階段動態組合，而非編譯時寫死。

## 目錄限制守衛 (Directory Guard)

`restrictToDirectory` 是一個高階函式，回傳一個 `pi-agent-core` 的 `beforeToolCall` 掛鉤（hook）。守衛檢查工具呼叫的所有已知路徑參數（`filePath`、`path`、`targetPath`、`sourcePath`），確保其解析後不超出允許的目錄範圍。

檢查規則：

- 絕對路徑直接比對前綴
- 相對路徑先以允許目錄為基礎進行解析再比對
- 違規時回傳 `{ block: true, reason }` 阻擋呼叫；通過時回傳 `undefined` 放行

此機制從架構層級防止代理透過 `../` 路徑遍歷存取未授權的目錄。
