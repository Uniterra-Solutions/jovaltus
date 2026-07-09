# Jovaltus — 技術提案書

**提案編號：** JV-PROP-001  
**版本：** v1.0（草案）  
**日期：** 2026-07-09  
**狀態：** 待審議

---

## 摘要

Jovaltus 是一個專為 VS Code 設計的自訂 AI coding agent，以多層品質管線為核心架構，解決現有 coding agent 品質控制完全依賴人類審查的根本問題。透過精確的 context 邊界設計、多層自動 review-fix 循環，以及動態驗證機制，Jovaltus 旨在用最少的 token 消耗達到最高的交付品質。

---

## 目錄

1. [背景與問題](#1-背景與問題)
2. [設計哲學](#2-設計哲學)
3. [系統需求概述](#3-系統需求概述)
4. [業務邏輯架構](#4-業務邏輯架構)
5. [技術架構](#5-技術架構)
6. [與現行方案之比較](#6-與現行方案之比較)
7. [開發規模估算](#7-開發規模估算)
8. [實施路徑](#8-實施路徑)

---

## 1. 背景與問題

### 1.1 現有方案之局限

當前的 AI coding agent 市場主要產品——Cline、Claude Code、Codex CLI——均採用單一 agent loop 的架構設計。其運作模式為：接收任務、執行工具、產出結果，品質控制端賴人類開發者在終點進行程式碼審查。

此模式存在三項結構性問題：

**第一，品質閘門後置。** 所有品質檢查集中在開發流程的最後階段，問題發現得越晚，修正成本越高。跨檔案、跨模組的整合問題尤其容易在人類審查中被遺漏。

**第二，Context 浪費。** 單一 agent 在長時間 session 中累積大量上下文，token 消耗持續增長，但其中包含大量與當前任務無關的資訊。模型被迫在噪音中尋找訊號。

**第三，審查負擔隨產能線性增長。** 隨著 agent 產出速度提升，人類開發者的審查負擔同步增加，形成新的瓶頸。這在大型專案中尤為明顯。

### 1.2 機會

最新研究（Dive into Claude Code, 2026）指出，Claude Code 的程式碼中 98.4% 是基礎設施，僅 1.6% 是 AI 決策邏輯。這意味著改善 coding agent 的關鍵不在於模型能力，而在於圍繞 agent loop 的系統架構設計。Jovaltus 正是以此為出發點。

---

## 2. 設計哲學

### 2.1 核心命題

> **用最少的 token，達到最高的交付品質。**

### 2.2 設計原則

**原則一：Context 經濟**
每個 agent 只應看見完成其職責所需的最小資訊集合。不多看一行不需要的程式碼。跨層級傳遞時，只傳遞起點與終點的差異（clean diff），不包含中間的修復痕跡。

**原則二：品質閘門分散化**
品質控制不應集中於流程終點。每個階段、每個層級都應設有自動化的審查閘門，問題在發生處即時被發現與修正。

**原則三：Review-Fix 循環自動化**
發現問題與修正問題應形成自動循環，無需人類介入。Reviewer 負責發現，Fixer 負責修正，循環直至通過。

**原則四：代碼即負債**
每一行不需要的程式碼都是利息。專屬的 simplifier agent 在 review 通過後對程式碼進行壓縮，確保不多寫一行不必要的程式碼。

**原則五：行為由文件驅動**
Agent 的角色定義與行為規則應寫入 system prompt，而非寫死在程式碼中。這確保行為的可配置性與可審查性。

### 2.3 架構層級定位

Jovaltus 與現有 coding agent 的差別不是功能多寡，而是架構思維的完全不同層級：

> 現有 coding agent 是一個「可以寫程式的 LLM」——給它任務，它寫完給你，然後你負責審查品質。Jovaltus 是一個「軟體開發工廠」——在架構層級內建多層品質管線，讓 agent 之間互相審查、修復、簡化、驗證，人類只負責最初的需求定義與最終的簽收。

---

## 3. 系統需求概述

### 3.1 兩種操作模式

系統應提供兩種操作模式，以適應不同規模與複雜度的開發任務。

**3.1.1 Agent Mode（輕量模式）**

適用場景：簡單 bug fix、小修改、單一檔案調整。

模型選擇：用戶可在對話介面自由選擇欲使用的模型，無 Coordinator/Worker 之分。此設計符合 Agent Mode 的靈活定位——用戶根據任務複雜度自行決定模型取捨。

流程如下：

1. **實作階段**：單一 agent 依照任務描述完成修改，不進行 worker 拆分。
2. **提煉與規劃階段**：Planner Agent 讀取實作 agent 的完整上下文，從中提煉出任務內容、實作計劃、驗收條件。同時進行程式碼庫檢索，識別受影響的模組。產出完整的檢查計劃，指定需要執行的 agentic E2E 測試與業務邏輯驗證項目。
3. **驗證與修復階段**：原始實作 agent 根據檢查計劃自行執行驗證。發現 bug 時立即修復，修復後重新驗證，循環直至全部通過。
4. **簡化階段**：Simplifier Agent 取得實作開始前 versus 驗證後的最終程式碼 diff（忽略中途所有修改痕跡），進行簡化。簡化完成後重新運行相關業務邏輯測試，確認簡化未破壞功能。

此模式不需人類介入需求討論與任務拆分流程，適合小型變更。

**3.1.2 Full Mode（完整模式）**

適用場景：完整功能開發、跨檔案重構、複雜 bug 修復。

Full Mode 分為五個階段執行，每個階段皆有明確的產出與品質閘門：

| 階段    | 名稱               | 執行角色              | 主要產出              |
| ------- | ------------------ | --------------------- | --------------------- |
| Phase 1 | 需求討論與定義     | Main Agent            | SPEC.md + DESIGN.md   |
| Phase 2 | 需求拆分與任務計劃 | Planner Agent         | PROMPT.md + plan/*.md |
| Phase 3 | 批次執行           | Coordinator + Workers | 實作完成的程式碼      |
| Phase 4 | 最終 Spec Review   | Spec Reviewer         | 審查結論              |
| Phase 5 | 動態驗證與即時修復 | Verification Agent    | 驗證報告              |

### 3.2 Full Mode 各階段詳述

**Phase 1 — 需求討論與定義**

Main Agent 以對話方式引導用戶逐步釐清需求，涵蓋範圍邊界、用戶場景、技術約束、業務價值等面向。所有模糊點需在進入下一階段前解決。產出 SPEC.md（業務規格書，含 BDD 格式的驗收條件）與 DESIGN.md（技術設計文件）。

**Phase 2 — 需求拆分與任務計劃**

Planner Agent 以獨立 context 運作，只讀取 Phase 1 產出的 SPEC.md 與 DESIGN.md，不繼承與用戶的對話歷史。其職責包括：

- 將設計拆解為 N 個「足夠簡單」的任務，每個任務的粒度應使 worker agent 不需大量思考即可執行
- 定義任務之間的依賴關係
- 根據檔案重疊情況決定平行化策略
- 組成執行批次並排定順序

產出 PROMPT.md（協調者指令）與 plan/*.md（各 worker 的自包含任務指令）。

**Phase 3 — 批次執行**

Coordinator 依照 Phase 2 的批次計劃調度 worker：

- 每個 Worker 在獨立的 git worktree 中作業
- Worker 完成後觸發專屬的 Reviewer Agent（僅看此 worker 的修改）
- Review 未通過 → Fixer Agent（收到修復計劃 + 上輪程式碼）→ 再次 Review，循環直至通過
- Review 通過後 → Simplifier Agent → 任務完成
- 批次內所有 Worker 完成後 → Batch Final Review（檢查跨任務整合）
  - 通過 → 合併回主分支
  - 未通過 → Batch Fixer（收到所有計劃文檔 + 起點 versus 最終的 clean diff）→ Review 循環直至通過

**Phase 4 — 最終 Spec Review**

Spec Reviewer 取得原始 SPEC.md + DESIGN.md，以及所有批次開始前 versus 全部完成後的 clean diff，審查整體架構一致性與 spec 滿足度。未通過時由 Spec Fixer 進行修復，循環直至通過。

**Phase 5 — 動態驗證與即時修復**

Verification Agent 為最後一道品質閘門：

- 讀取 SPEC.md 提取所有 BDD 驗收條件
- 透過 bash 命令操作實際運行的應用程式，逐條驗證
- 驗證失敗時由 Verification Fixer 進行即時修復，修復後再次驗證
- 循環直至全部通過

---

## 4. 業務邏輯架構

### 4.1 通用 Agent 抽象模型

系統中所有 agent 角色均透過同一套工廠方法實例化，差異僅來自三個維度的配置：

| 配置維度          | 說明                         | 範例                                  |
| ----------------- | ---------------------------- | ------------------------------------- |
| **System Prompt** | 角色定義、行為規則、輸出格式 | 「你是審查 agent，只讀不寫」          |
| **Context**       | 輸入資訊的範圍與來源         | 「這份 diff + 對應的計劃文檔」        |
| **Tools**         | 允許使用的工具集合           | 「唯讀模式：read + bash（不寫檔案）」 |

此設計確保行為由文件驅動而非程式碼驅動，新增角色只需撰寫新的 system prompt 與配置組合，無需新增程式碼檔案。

### 4.2 角色與配置總表

| #   | 角色                   | 所屬模式/階段     | 模型層級    | System Prompt 定位     | Context                                     | Tools                      |
| --- | ---------------------- | ----------------- | ----------- | ---------------------- | ------------------------------------------- | -------------------------- |
| 1   | **Main Agent**         | Full Mode Phase 1 | Coordinator | 需求引導 agent         | 用戶對話歷史                                | 檔案讀寫（限 SPEC/DESIGN） |
| 2   | **Planner Agent**      | Full Mode Phase 2 | Coordinator | 任務計畫 agent         | SPEC.md + DESIGN.md                         | 檔案讀寫 + 搜尋            |
| 3   | **Planner Agent**      | Agent Mode Step 2 | Coordinator | 提煉與規劃 agent       | 實作 agent 完整上下文                       | 檔案讀取 + 搜尋            |
| 4   | **Worker Agent**       | Full Mode Phase 3 | Worker      | 開發實作 agent         | 自己的 plan/*.md + 相關程式碼               | 讀寫編輯 + 命令執行        |
| 5   | **Reviewer Agent**     | Phase 3 Worker 層 | Coordinator | 審查 agent（唯讀）     | 目標 diff + 對應計劃                        | 唯讀                       |
| 6   | **Fixer Agent**        | Phase 3 Worker 層 | Worker      | 修復 agent             | 審查計劃 + 上輪程式碼                       | 讀寫編輯 + 命令執行        |
| 7   | **Simplifier Agent**   | Phase 3 Worker 層 | Worker      | 簡化 agent             | clean diff                                  | 讀寫編輯 + 命令執行        |
| 8   | **Batch Reviewer**     | Phase 3 Batch 層  | Coordinator | 批次審查 agent         | 所有計劃文檔 + batch clean diff             | 唯讀                       |
| 9   | **Batch Fixer**        | Phase 3 Batch 層  | Worker      | 批次修復 agent         | 計劃文檔 + clean diff + 審查計劃            | 讀寫編輯 + 命令執行        |
| 10  | **Spec Reviewer**      | Phase 4           | Coordinator | 規格審查 agent         | SPEC.md + DESIGN.md + spec clean diff       | 唯讀                       |
| 11  | **Spec Fixer**         | Phase 4           | Worker      | 規格修復 agent         | SPEC.md + DESIGN.md + clean diff + 審查計劃 | 讀寫編輯 + 命令執行        |
| 12  | **Verification Agent** | Phase 5           | Coordinator | 驗證 agent（不寫檔案） | SPEC.md BDD + clean diff                    | 僅命令執行                 |
| 13  | **Verification Fixer** | Phase 5           | Worker      | 驗證修復 agent         | 驗證 context + 失敗證據                     | 讀寫編輯 + 命令執行        |

### 4.3 Context 邊界策略

Context 邊界為本系統 token 經濟的核心機制。各層級 agent 所見的資訊範圍嚴格限制：

**Worker 層級：**

- Worker 僅見自己的計劃文檔與相關程式碼
- Reviewer 僅見同一 worker 的修改 diff
- Fixer 在前次 reviewer 所見的基礎上疊加修復
- Simplifier 僅見最終修改集，不包含過程中的 fix 痕跡

**Batch 層級：**

- Batch Reviewer 與 Batch Fixer 僅見「起點 versus 最終」的 clean diff
- 不包含任何 worker 內部的 review、fix、simplify 過程
- 此為跨層級 token 節省的核心機制

**Spec 層級：**

- Spec Reviewer 與 Spec Fixer 僅見全專案 clean diff 與 SPEC/DESIGN 文件
- 不帶批次內部的執行細節

**Verification 層級：**

- Verification Agent 僅見 SPEC.md 的 BDD 驗收條件
- 不讀取任何程式碼，僅透過 bash 操作應用程式

### 4.4 Review-Fix 循環設計

系統設有四層 review-fix 循環，由內向外形成品質防護網：

**第一層 — Worker 層（最內層）：**
Reviewer 發現問題 → Fixer 收到審查計劃與上輪程式碼 → 修復 → Reviewer 再次審查（疊加 fixer 修改）→ 循環直至通過 → Simplifier

**第二層 — Batch 層：**
批次內所有 worker 完成後 → Batch Final Review → 發現跨任務整合問題 → Batch Fixer（收到 clean diff + 審查計劃）→ Review 循環直至通過

**第三層 — Spec 層：**
全部批次完成後 → Spec Review（對照原始 SPEC/DESIGN）→ 發現 spec 滿足度問題 → Spec Fixer → 循環直至通過

**第四層 — Verification 層（最外層）：**
Verification Agent 執行 BDD 驗證 → 發現驗證失敗 → Verification Fixer 收到失敗證據 → 修復 → 重新驗證 → 循環直至全部通過

每輪 reviewer 所見的修改範圍只增不減（第一輪見原始修改，第二輪見原始加 fixer 首輪修改，第三輪再加 fixer 第二輪修改），確保審查的完整性。

### 4.5 平行化策略

平行化的唯一硬約束為**檔案重疊（file overlap）**：

- 同一批次內的 worker 必須修改零重疊的檔案集合，始得平行執行
- 任何檔案重疊 → 必須依序執行
- 邏輯依賴關係進一步約束執行順序

此策略從架構層級杜絕平行化可能導致的檔案衝突。

---

## 5. 技術架構

### 5.1 系統架構概覽

```
┌──────────────────────────────────────────────────┐
│  VS Code Extension Host                          │
│                                                   │
│  ┌─────────────┐  ┌──────────────────────────┐   │
│  │ Extension   │  │ Webview（assistant-ui）   │   │
│  │ Entry       │  │  └─ adapter（事件串接）   │   │
│  │ (activation)│  └──────────────────────────┘   │
│  └──────┬──────┘                                  │
│         │ 訊息傳遞                                │
│         ▼                                         │
│  ┌──────────────────────────────────────────┐   │
│  │ Core Engine                               │   │
│  │                                           │   │
│  │  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │ Agent        │  │ 基礎設施模組      │  │   │
│  │  │ Runtime      │  │ ├─ Worktree Mgr  │  │   │
│  │  │ (pi-agent-   │  │ ├─ Diff Mgr      │  │   │
│  │  │  core)       │  │ ├─ State Mgr     │  │   │
│  │  │              │  │ └─ Planner Core  │  │   │
│  │  └──────┬───────┘  └──────────────────┘  │   │
│  │         │                                 │   │
│  │         ▼                                 │   │
│  │  ┌──────────────────────────────────┐   │   │
│  │  │ Mode Orchestrators               │   │   │
│  │  │ ├─ Agent Mode（4 階段循環）       │   │   │
│  │  │ └─ Full Mode（5 階段管線）        │   │   │
│  │  └──────────────────────────────────┘   │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### 5.2 工作目錄配置

Full Mode 的每個 session 將產出統一儲存於以下目錄結構：

```
~/.jovaltus/
  └── <YYYY-MM-DD_HHMMSS>-<project_name>/
        ├── SPEC.md
        ├── DESIGN.md
        ├── PROMPT.md
        ├── plan/          # 各 worker 的任務指令
        ├── fix/           # 修復 worker 指令
        └── references/    # 外部 API 與方法參考
```

目錄名稱以日期時間加專案名稱組成，確保每次 session 的產出可追溯且不互相干擾。

### 5.3 權限控制機制

各角色依其職責享有不同程度的檔案系統權限：

| 角色               | 可操作目錄        | 寫入權限                 |
| ------------------ | ----------------- | ------------------------ |
| Main Agent         | Session 目錄      | 限 SPEC.md + DESIGN.md   |
| Planner Agent      | Session 目錄      | 限 PROMPT.md + plan/*.md |
| Worker Agent       | 專屬 git worktree | 完整開發權限             |
| Reviewer Agent     | 專屬 git worktree | 唯讀                     |
| Simplifier Agent   | 專屬 git worktree | 可寫，僅限簡化           |
| Verification Agent | 無                | 無檔案權限，僅命令執行   |

### 5.4 技術棧

**已確定：**

| 維度          | 選擇              | 理由                                                                                                                        |
| ------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Agent Runtime | pi-agent-core     | 最小依賴，僅提供 agent loop 與 tool execution                                                                               |
| LLM 抽象      | pi-ai             | 原生搭配，統一多 provider 介面                                                                                              |
| 介面形式      | VS Code Extension | 目標平台                                                                                                                    |
| 對話 UI       | assistant-ui      | 11,000+ GitHub stars 的開源 React 對話框架，支援 streaming、markdown、tool call 顯示，runtime-agnostic 可串接 pi-agent-core |
| 驗證工具      | bash              | 通用於前後端、API、CLI、資料庫，單一介面涵蓋所有驗證場景                                                                    |
| 隔離機制      | Git worktree      | 原生支援，無需額外基礎設施                                                                                                  |

### 5.5 模型配置策略

Full Mode 採用雙模型配置，以在能力與成本之間取得最佳平衡：

**Coordinator Model（協調者模型）：**

- 用於需要深度推理與決策品質的階段：需求討論（Phase 1）、規格與設計產出（Phase 1）、任務拆分與計劃（Phase 2）、Review Agent 審查（Phase 3-4）、Batch/Spec Review、Verification Agent 驗證（Phase 5）
- 選用較高能力之模型，單價較高但使用頻率低

**Worker Model（工作者模型）：**

- 用於大量重複性的實作工作：Worker Agent 程式碼實作（Phase 3）、Fixer Agent 修復、Simplifier Agent 簡化
- 選用成本較低之模型，使用頻率高但每個 task context 極小
- 進一步壓低整體 token 成本

此配置策略與系統的 context 經濟設計相輔相成——Worker Model 處理大量但輕量的工作，Coordinator Model 處理少量但關鍵的決策。

### 5.6 模型協議支援

系統需支援以下兩種模型接入協議：

- **OpenAI 協議**：相容之 base URL 與 API key 配置
- **Anthropic 協議**：相容之 base URL 與 API key 配置

用戶可自由指定各協議的端點位址與對應的認證資訊，以使用自託管或第三方模型服務。

### 5.7 待決定的技術項目

| 維度             | 選項                            |
| ---------------- | ------------------------------- |
| State Management | React Context / Zustand         |
| Diff 顯示        | VS Code diff editor API         |
| Worktree 管理    | 原生 git 命令 / wrapper library |
| Session 持久化   | JSONL / SQLite                  |

---

## 6. 與現行方案之比較

### 6.1 比較對象

本節比較對象為當前主流的開源 coding agent：Cline（~64,000 stars）、Claude Code（Anthropic）、Codex CLI（OpenAI，~67,000 stars）。

### 6.2 比較維度

| 維度             | Cline / Claude Code / Codex CLI | Jovaltus                               |
| ---------------- | ------------------------------- | -------------------------------------- |
| **循環層數**     | 1 層（單一 agent loop）         | 4 層（Worker→Batch→Spec→Verification） |
| **審查機制**     | 人類開發者審查 diff             | 自動多層 Review-Fix 循環               |
| **修復循環**     | 人類手動修正                    | 自動 Reviewer → Fixer → 循環直至通過   |
| **Context 隔離** | 單一 session 共享 context       | 各 agent 獨立 context，clean diff 傳遞 |
| **動態驗證**     | 無，或少數單元測試              | Verification Agent 逐條驗證 BDD        |
| **程式碼簡化**   | 無                              | 專屬 Simplifier Agent                  |
| **操作模式**     | 單一模式                        | Agent Mode（輕量）+ Full Mode（完整）  |
| **平行化約束**   | 無明確機制                      | File overlap 硬柵欄                    |

### 6.3 關鍵差異

現有 coding agent 的基礎設施（權限系統、context 管理、錯誤復原）雖然複雜，但它們解決的都是單一 agent 在單一 session 中的問題。Jovaltus 解決的是多層品質管線的問題——這不是同一產品的功能差異，而是完全不同的架構層級。

---

## 7. 開發規模估算

### 7.1 分層規模

| 層級                   | 估計行數   | 說明                                   |
| ---------------------- | ---------- | -------------------------------------- |
| Extension Shell        | ~400       | 套件註冊、activation、Webview provider |
| Agent Runtime + Tools  | ~800       | pi-agent-core 封裝與工具定義           |
| Agent Factory + 配置表 | ~150       | 通用 agent 實例化                      |
| 基礎設施               | ~900       | worktree/diff/state/planner-core 管理  |
| Agent Mode             | ~500       | 四階段循環協調                         |
| Full Mode              | ~1,200     | 五階段管線協調                         |
| assistant-ui adapter   | ~300       | 前端事件串接                           |
| **合計**               | **~4,250** |                                        |

### 7.2 對比參考

| 專案        | 規模        |
| ----------- | ----------- |
| Jovaltus    | ~4,250 行   |
| Claude Code | ~512,000 行 |
| Cline SDK   | ~50,000+ 行 |

---

## 8. 實施路徑

### 第一階段 — MVP

- 建立 VS Code Extension scaffold
- 建立 assistant-ui 與 pi-agent-core 之間的 adapter
- 實作 Agent Mode（實作 → planner 提煉 → 驗證 → simplifier）
- 實作基礎工具集（檔案讀寫編輯、命令執行）
- 實作 git worktree 管理

### 第二階段 — Full Mode 核心

- 實作 Phase 1（Main Agent 需求引導）
- 實作 Phase 2（Planner Agent 任務拆分）
- 實作 Phase 3 Worker 層（Worker + Reviewer + Fixer + Simplifier）
- 實作 clean diff 生成與傳遞機制
- 實作 batch 層級 review-fix 循環

### 第三階段 — Full Mode 完整

- 實作 Phase 4（Spec Review + Fixer）
- 實作 Phase 5（Verification Agent + Fixer）
- 實作 token 消耗儀表板
- 實作 Full Mode 流程可視化
- 實作自訂 tool / skill 載入機制

---

**文件結束**
