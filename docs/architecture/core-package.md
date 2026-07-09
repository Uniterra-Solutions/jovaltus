# 核心套件（Core Package）設計原則

來源：`packages/core/src/index.ts`、`packages/core/src/agent/factory.ts`、`packages/core/src/config/manager.ts`

## 套件定位

`@jovaltus/core` 是 Jovaltus 的核心引擎，實作為一個純 TypeScript 函式庫，對 VS Code 無任何依賴。此設計確保核心邏輯可被任意主機（CLI、Web 應用、其他編輯器擴充套件）復用。

## 代理工廠模式 (Agent Factory)

代理實例由工廠函式 `createAgent` 根據三個配置維度統一生產：

- **System Prompt**：定義角色行為與輸出格式（從外部注入，非寫死在程式碼中）
- **Context**：控制代理可見的資訊範圍（檔案路徑、程式碼片段、diff）
- **Tools**：控制代理可執行的操作集合（唯讀、讀寫、驗證三種等級）

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

- **Agent 模組**：代理實例化與生命週期管理。對外僅暴露 `createAgent`、`createModelRegistry`、`ToolRegistry`、`restrictToDirectory`。
- **Config 模組**：配置類型定義、預設值、合併邏輯、上下文視窗自動偵測。對外僅暴露 `ConfigManager`、`DEFAULT_CONFIG`、`resolveContextWindow`。
- **Model 模組**：低層次模型存取抽象。對外僅暴露 `createModelClient`、`ModelError`、`OpenAIProvider`、`AnthropicProvider`。
- **Tools 模組**：內建工具定義與能力分級預設組合。對外僅暴露四個工具常數與三組預設工具集合。

## 公共 API 約定

核心套件的公共 API 嚴格定義於 `src/index.ts`，所有對外符號均顯式匯出（無 wildcard re-export）。內部模組的實作細節不會透過 barrel export 洩漏。此約定確保公共合約的穩定性與可審查性。
