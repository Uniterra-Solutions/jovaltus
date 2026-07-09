# 代理模式流水線（Agent Mode Pipeline）設計原則

來源：`packages/core/src/orchestrator/agent-mode.ts:1-567`、`packages/core/src/orchestrator/types.ts:1-57`

## 流水線架構

`AgentModeOrchestrator` 是一個事件驅動的四階段流水線，將使用者任務描述轉化為經過驗證和簡化的程式碼變更：

```
使用者任務 → Phase 1 (實作) → Phase 2 (規劃) → Phase 3 (驗證與修復) → Phase 4 (簡化 → 重新驗證)
```

每次階段轉換均使用**乾淨的 git commit** 作為狀態邊界，確保後續階段可以透過 `CleanDiffManager` 計算階段間的淨變更。

來源：`packages/core/src/orchestrator/agent-mode.ts:159-178`

## 階段詳解

### Phase 1: 實作（Implementation）

- **代理角色**：`worker`（低成本模型）
- **工具集**：`READ_WRITE_TOOLS`（read + write + edit + bash）
- **輸入**：使用者原始任務描述
- **輸出**：附帶完整 transcript（system prompt + messages）的 `PhaseResult`

執行流程：

1. 捕獲 git HEAD 作為起始 commit
2. 建立 worker 代理，注入實作系統提示（`agent-mode.ts:21-26`）
3. 將使用者任務作為 prompt 發送給代理
4. 等待代理空閒（`waitForIdle()`）
5. 自動提交為 `jovaltus: agent mode implementation`
6. 捕獲 transcript（`agent.state.systemPrompt` + `[...agent.state.messages]`）供 Phase 2 使用

來源：`packages/core/src/orchestrator/agent-mode.ts:182-200`

### Phase 2: 蒸餾與規劃（Distill & Plan）

- **代理角色**：`coordinator`（高能力模型）
- **工具集**：`READ_ONLY_TOOLS`（read + bash）
- **輸入**：Phase 1 的 transcript（僅 user + assistant 訊息，排除 toolResult）
- **輸出**：結構化的 `CheckPlan`

Planner 代理分析實作階段的工作記錄，產生結構化摘要：

- **Task Summary**：實作內容的一段式摘要
- **Implementation Plan**：採用的實作方法
- **Acceptance Criteria**：從任務中推導的驗收條件
- **Affected Modules**：受影響的模組路徑
- **Verification Items**：具體的驗證命令（description + command 配對）

解析器從代理輸出中擷取標記章節並建構型別安全的 `CheckPlan` 物件。

來源：`packages/core/src/orchestrator/agent-mode.ts:204-223, 28-59, 398-432`

### Phase 3: 驗證與修復循環（Verify & Fix Loop）

系統在此階段建立**兩個獨立的代理**：

| 代理     | 角色          | 工具集                    | 職責                        |
| -------- | ------------- | ------------------------- | --------------------------- |
| Verifier | `coordinator` | `VERIFY_TOOLS`（僅 bash） | 執行驗證命令，判斷通過/失敗 |
| Fixer    | `worker`      | `READ_WRITE_TOOLS`        | 接收失敗診斷，實施修復      |

循環機制（`agent-mode.ts:278-309`）：

1. Verifier 執行所有待處理的驗證項目，以 `[PASS]` / `[FAIL]` 行回報結果
2. 解析結果時擷取 `[FAIL]` 行後的錯誤輸出（`parseResults`，`agent-mode.ts:434-464`）
3. 若全部通過 → 循環結束；若存在失敗：
   a. 將失敗描述的錯誤與原始指令重新關聯（`agent-mode.ts:291-294`）
   b. 將失敗診斷作為 prompt 發送給 Fixer
   c. Fixer 實施修復，將命令作為待處理項目進行重新測試
   d. 重複最多 3 次（`MAX_FIX_RETRIES = 3`，`agent-mode.ts:85`）
4. 若超過重試上限後仍有失敗項 → phase 失敗

修復完成後自動提交為 `jovaltus: agent mode verification fixes`。

來源：`packages/core/src/orchestrator/agent-mode.ts:227-253, 61-74`

### Phase 4: 簡化（Simplification）

- **代理角色**：`worker`（低成本模型）
- **工具集**：`READ_WRITE_TOOLS`
- **輸入**：執行起始點（實作 commit 的父節點）到當前 HEAD 之間的淨差異（clean diff）

執行流程：

1. 找到實作 commit：`git log --grep='^jovaltus: agent mode implementation$'`
2. 計算從 `implCommit^` 到 `HEAD` 的淨差異，使用 `CleanDiffManager`
3. 將差異輸入給 simplifier 代理，並指示其進行簡化
4. **Phase 4b: 簡化後重新驗證** — 使用全新的 verifier + fixer 代理對原始驗證項目清單重新執行 `verifyLoop`，以確保簡化未引入回歸（`agent-mode.ts:255-276`）

來源：`packages/core/src/orchestrator/agent-mode.ts:313-341, 76-83, 170-175`

## 中斷訊號傳播（AbortSignal Propagation）

`AbortSignal` 在整條流水線中傳播：`run()` → 每個 phase method → `runAgent()`。在 `runAgent()` 內部（`agent-mode.ts:347-368`），訊號以 `addEventListener('abort', handler)` 監聽，觸發 `agent.abort()`。監聽器在 `finally` 區塊中移除，確保不會洩漏。

來源：`packages/core/src/orchestrator/agent-mode.ts:358-365`

## 事件系統

`AgentModeOrchestrator` 暴露出一個發佈-訂閱事件流的 `onEvent()` 方法，供主機（例如 VS Code 擴充套件）消費進度更新。六種事件類型：

| 事件類型       | 觸發時機         | 承載資料                     |
| -------------- | ---------------- | ---------------------------- |
| `phase_start`  | 每個階段開始時   | `phase: PhaseName`           |
| `phase_end`    | 每個階段結束時   | `phase, result: PhaseResult` |
| `stream_delta` | 代理串流文字增量 | `phase, text: string`        |
| `tool_call`    | 代理呼叫工具時   | `phase, toolName, args`      |
| `tool_result`  | 工具呼叫完成時   | `phase, toolName, isError`   |
| `error`        | 階段失敗時       | `phase, message`             |

事件監聽器的錯誤會被靜默吞沒，防止單一監聽器的崩潰影響整體流水線（`agent-mode.ts:522`）。

來源：`packages/core/src/orchestrator/types.ts:41-57`、`packages/core/src/orchestrator/agent-mode.ts:154-157, 334-393, 521-523`

## 系統提示（System Prompts）

所有系統提示均定義為 `agent-mode.ts` 中的模組層級常數，可透過建構子選項覆蓋（`AgentModeOptions`，`types.ts:31-38`）：

- `IMPL_PROMPT`（實作，`agent-mode.ts:21-26`）
- `PLANNER_PROMPT`（規劃器，`agent-mode.ts:28-59`）
- `VERIFIER_PROMPT`（驗證器，`agent-mode.ts:61-66`）
- `FIXER_PROMPT`（修復器，`agent-mode.ts:68-74`）
- `SIMPLIFIER_PROMPT`（簡化器，`agent-mode.ts:76-83`）

此設計實現了**透過配置定義行為**：代理角色由系統提示 + 工具預設組定義，而非硬編碼邏輯。

來源：`packages/core/src/orchestrator/agent-mode.ts:131-149`

## 模組邊界

Orchestrator 模組依賴：

- `agent/factory.ts`（`createAgent`）— 代理實例化
- `agent/types.ts`（`CreateAgentOptions`）— 代理選項類型
- `agent/tools/index.ts`（工具預設組）— READ_ONLY_TOOLS、READ_WRITE_TOOLS、VERIFY_TOOLS
- `diff/manager.ts`（`CleanDiffManager`）— Phase 4 淨差異計算
- `git.ts`（`execGit`）— commit 捕獲與自動提交
- `config/types.ts`（`JovaltusConfig`）— 配置類型

Orchestrator **不依賴**於 VS Code、model/ 模組或 planner 模組。它不直接呼叫模型 — 所有 LLM 互動均透過 Agent API（`prompt()` → `waitForIdle()`）進行。

來源：`packages/core/src/orchestrator/agent-mode.ts:1-8`
