# 核心套件（Core Package）設計原則

來源：`packages/core/src/index.ts`、`packages/core/src/agent/factory.ts`、`packages/core/src/agent/output-validation.ts`、`packages/core/src/config/manager.ts`、`packages/core/src/worktree/manager.ts`、`packages/core/src/diff/manager.ts`、`packages/core/src/planner/core.ts`、`packages/core/src/orchestrator/agent-mode.ts`

## 套件定位

`@jovaltus/core` 是 Jovaltus 的核心引擎，實作為一個純 TypeScript 函式庫，對 VS Code 無任何依賴。此設計確保核心邏輯可被任意主機（CLI、Web 應用、其他編輯器擴充套件）復用。

## 代理工廠模式 (Agent Factory)

代理實例由工廠函式 `createAgent` 根據四個配置維度統一生產：

- **System Prompt**：定義角色行為與輸出格式（從外部注入，非寫死在程式碼中）
- **Context**：控制代理可見的資訊範圍（檔案路徑、程式碼片段、diff）
- **Tools**：控制代理可執行的操作集合（唯讀、讀寫、驗證三種等級）
- **OutputSchema**（可選）：設定後自動在 system prompt 中注入 JSON 格式範例，並透過 `onPayload` hook 對 OpenAI 相容 provider 注入 `response_format: {type: "json_object"}`。呼叫端使用 `promptWithValidation()` 進行 TypeBox 驗證 + 欄位錯誤回饋 + 自動重試（最多 3 次）

`createModelRegistry()` 根據 `config.provider` 只註冊所選單一 provider 的模型（coordinator 與 worker 各一個），而非兩邊都註冊。`createAgent()` 直接使用 `config.provider` 決定 API 協議。來源：`packages/core/src/agent/factory.ts:62-87`

代理角色分為兩級：`coordinator`（協調者，使用較高能力模型進行決策）與 `worker`（工作者，使用較低成本模型進行實作）。

## 雙通道模型抽象

核心套件中存在兩條獨立的 LLM 存取路徑，共享同一份配置定義：

1. **高層次路徑（Agent Factory）**：透過 `pi-ai` 模型註冊表 + `pi-agent-core` Agent 執行時，支援 streaming、工具呼叫、thinking 層級控制。用於代理的執行階段。
2. **低層次路徑（Model Client）**：透過原生 SDK（OpenAI / Anthropic）直接進行單次 completion 呼叫。提供統一的 `ModelClient` 介面與 `ModelError` 錯誤模型。

兩路徑互不依賴，共享 `config/types.ts` 中的配置定義作為唯一接合點。

## 配置解析鏈

配置透過三層優先序合併，由高至低為：

1. 程式覆寫（constructor overrides）
2. 主機配置（VS Code 設定，透過 `ConfigProvider` 介面注入）
3. 靜態預設值（`DEFAULT_CONFIG`）

`ConfigProvider` 是一個抽象介面，解耦核心套件與特定主機的配置機制。核心套件不直接依賴 VS Code 配置 API，而是依賴 `ConfigProvider.get(section, defaultValue)` 合約。

## 模組邊界

- **Agent 模組**：代理實例化、生命週期管理，以及結構化輸出驗證。對外暴露 `createAgent`、`createModelRegistry`、`ToolRegistry`、`restrictToDirectory`、`promptWithValidation`、`validateOutput`、`extractJsonFromText`、`generateJsonExample`。來源：`packages/core/src/agent/factory.ts:98-131`、`packages/core/src/agent/output-validation.ts:10-123`。
- **Config 模組**：配置類型定義、預設值、合併邏輯、上下文視窗自動偵測。對外暴露 `ConfigManager`、`DEFAULT_CONFIG`、`resolveContextWindow`、`discoverContextWindow`。
- **Model 模組**：低層次模型存取抽象。對外暴露 `createModelClient`、`ModelError`、`OpenAIProvider`、`AnthropicProvider`。
- **Tools 模組**：內建工具定義與能力分級預設組合。對外暴露四個工具常數與三組預設工具集合。
- **Worktree 模組**：Git worktree 生命週期管理（create, list, get, merge, remove）。支援分支衝突檢測、dirty worktree 保護、合併衝突結構化回傳。對外暴露 `WorktreeManager`、`WorktreeError`、相關類型。來源：`packages/core/src/worktree/manager.ts`。
- **Diff 模組**：跨層級 clean diff 計算（Worker/Batch/Spec 三級），計算起點 vs 終點的差異，不包含中間修改痕跡。支援檔案過濾、rename 檢測、50KB diff 截斷。對外暴露 `CleanDiffManager`、`DiffError`、相關類型。來源：`packages/core/src/diff/manager.ts`。
- **Planner 模組**：任務排程核心邏輯，使用 Kahn 拓撲排序演算法配合檔案重疊感知的批次分組。支援 explicit dependency、output dependency、循環依賴檢測（三色 DFS）。純邏輯模組，無 I/O 或 Git 依賴。對外暴露 `PlannerCore`、`PlannerError`、相關類型。來源：`packages/core/src/planner/core.ts`。
- **Orchestrator 模組**：事件驅動的四階段代理流水線（實作 → 規劃 → 驗證與修復 → 簡化 → 重新驗證），使用乾淨的 git commit 邊界與 `CleanDiffManager` 進行階段間淨差異計算。分離 coordinator（驗證器、規劃器）與 worker（實作器、修復器、簡化器）角色。支援 AbortSignal 傳播、錯誤輸出擷取及指令透過 verify-fix 循環的恢復。對外暴露 `AgentModeOrchestrator`、`CheckPlanSchema`、相關類型。來源：`packages/core/src/orchestrator/agent-mode.ts:1-598`。詳見 `docs/architecture/orchestrator-pipeline.md`。

## 公共 API 約定

核心套件的公共 API 嚴格定義於 `src/index.ts`，所有對外符號均顯式匯出（無 wildcard re-export）。內部模組的實作細節不會透過 barrel export 洩漏。此約定確保公共合約的穩定性與可審查性。
