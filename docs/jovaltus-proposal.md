1|# Jovaltus — 技術提案書
2|
3|**提案編號：** JV-PROP-001  
4|**版本：** v1.0（草案）  
5|**日期：** 2026-07-09  
6|**狀態：** 待審議
7|
8|---
9|
10|## 摘要
11|
12|Jovaltus 是一個專為 VS Code 設計的自訂 AI coding agent，以多層品質管線為核心架構，解決現有 coding agent 品質控制完全依賴人類審查的根本問題。透過精確的 context 邊界設計、多層自動 review-fix 循環，以及動態驗證機制，Jovaltus 旨在用最少的 token 消耗達到最高的交付品質。
13|
14|---
15|
16|## 目錄
17|
18|1. [背景與問題](#1-背景與問題)
19|2. [設計哲學](#2-設計哲學)
20|3. [系統需求概述](#3-系統需求概述)
21|4. [業務邏輯架構](#4-業務邏輯架構)
22|5. [技術架構](#5-技術架構)
23|6. [與現行方案之比較](#6-與現行方案之比較)
24|7. [開發規模估算](#7-開發規模估算)
25|8. [實施路徑](#8-實施路徑)
26|
27|---
28|
29|## 1. 背景與問題
30|
31|### 1.1 現有方案之局限
32|
33|當前的 AI coding agent 市場主要產品——Cline、Claude Code、Codex CLI——均採用單一 agent loop 的架構設計。其運作模式為：接收任務、執行工具、產出結果，品質控制端賴人類開發者在終點進行程式碼審查。
34|
35|此模式存在三項結構性問題：
36|
37|**第一，品質閘門後置。** 所有品質檢查集中在開發流程的最後階段，問題發現得越晚，修正成本越高。跨檔案、跨模組的整合問題尤其容易在人類審查中被遺漏。
38|
39|**第二，Context 浪費。** 單一 agent 在長時間 session 中累積大量上下文，token 消耗持續增長，但其中包含大量與當前任務無關的資訊。模型被迫在噪音中尋找訊號。
40|
41|**第三，審查負擔隨產能線性增長。** 隨著 agent 產出速度提升，人類開發者的審查負擔同步增加，形成新的瓶頸。這在大型專案中尤為明顯。
42|
43|### 1.2 機會
44|
45|最新研究（Dive into Claude Code, 2026）指出，Claude Code 的程式碼中 98.4% 是基礎設施，僅 1.6% 是 AI 決策邏輯。這意味著改善 coding agent 的關鍵不在於模型能力，而在於圍繞 agent loop 的系統架構設計。Jovaltus 正是以此為出發點。
46|
47|---
48|
49|## 2. 設計哲學
50|
51|### 2.1 核心命題
52|
53|> **用最少的 token，達到最高的交付品質。**
54|
55|### 2.2 設計原則
56|
57|**原則一：Context 經濟**
58|每個 agent 只應看見完成其職責所需的最小資訊集合。不多看一行不需要的程式碼。跨層級傳遞時，只傳遞起點與終點的差異（clean diff），不包含中間的修復痕跡。
59|
60|**原則二：品質閘門分散化**
61|品質控制不應集中於流程終點。每個階段、每個層級都應設有自動化的審查閘門，問題在發生處即時被發現與修正。
62|
63|**原則三：Review-Fix 循環自動化**
64|發現問題與修正問題應形成自動循環，無需人類介入。Reviewer 負責發現，Fixer 負責修正，循環直至通過。
65|
66|**原則四：代碼即負債**
67|每一行不需要的程式碼都是利息。專屬的 simplifier agent 在 review 通過後對程式碼進行壓縮，確保不多寫一行不必要的程式碼。
68|
69|**原則五：行為由文件驅動**
70|Agent 的角色定義與行為規則應寫入 system prompt，而非寫死在程式碼中。這確保行為的可配置性與可審查性。
71|
72|### 2.3 架構層級定位
73|
74|Jovaltus 與現有 coding agent 的差別不是功能多寡，而是架構思維的完全不同層級：
75|
76|> 現有 coding agent 是一個「可以寫程式的 LLM」——給它任務，它寫完給你，然後你負責審查品質。Jovaltus 是一個「軟體開發工廠」——在架構層級內建多層品質管線，讓 agent 之間互相審查、修復、簡化、驗證，人類只負責最初的需求定義與最終的簽收。
77|
78|---
79|
80|## 3. 系統需求概述
81|
82|### 3.1 兩種操作模式
83|
84|系統應提供兩種操作模式，以適應不同規模與複雜度的開發任務。
85|
86|**3.1.1 Agent Mode（輕量模式）**
87|
88|適用場景：簡單 bug fix、小修改、單一檔案調整。
89|
90|模型選擇：用戶可在對話介面自由選擇欲使用的模型，無 Coordinator/Worker 之分。此設計符合 Agent Mode 的靈活定位——用戶根據任務複雜度自行決定模型取捨。
91|
92|流程如下：
93|1. **實作階段**：單一 agent 依照任務描述完成修改，不進行 worker 拆分。
94|2. **提煉與規劃階段**：Planner Agent 讀取實作 agent 的完整上下文，從中提煉出三項資訊，以 JSON 結構化輸出：
95|   - context：任務背景資訊與執行者先前進行的相關修改摘要
96|   - tasks：完成用戶需求的詳細任務清單（含受影響檔案與驗證方式）
97|   - verification_gate：Verifier Agent 所需執行的驗證項目（E2E 測試、業務邏輯驗證、受影響模組）
98|   
99|   Planner Agent 同時進行程式碼庫檢索，識別受影響的模組。使用 Coordinator Model。
100|   
101|3. **驗證與修復階段**：Planner 的 JSON 直接傳遞給 Verifier Agent。Verifier Agent 同時負責驗證與修復，不分離 reviewer 與 fixer，省去 agent 間 context 傳遞的開銷。根據 verification_gate 執行驗證，發現 bug 即時修復，循環直至全部通過。使用 Coordinator Model。
102|
103|4. **簡化階段**：Simplifier Agent 取得實作開始前 versus 驗證後的最終程式碼 diff（忽略中途所有修改痕跡），進行簡化。簡化完成後重新運行相關業務邏輯測試，確認簡化未破壞功能。使用 Worker Model。
104|
105|Agent 間通訊全程使用 JSON 而非 markdown 文件。Planner 的輸出經 Zod schema 驗證後直接傳遞給 Verifier。
106|
107|此模式不需人類介入需求討論與任務拆分流程，適合小型變更。
108|
109|**3.1.2 Full Mode（完整模式）**
110|
111|適用場景：完整功能開發、跨檔案重構、複雜 bug 修復。
112|
113|Full Mode 分為五個階段執行，每個階段皆有明確的產出與品質閘門：
114|
115|| 階段 | 名稱 | 執行角色 | 主要產出 |
116||------|------|---------|---------|
117|| Phase 1 | 需求討論與定義 | Main Agent | SPEC.md + DESIGN.md |
118|| Phase 2 | 需求拆分與任務計劃 | Planner Agent | plan/*.md + 批次排程資料 |
119|| Phase 3 | 批次執行 | Coordinator + Workers | 實作完成的程式碼 |
120|| Phase 4 | 最終 Spec Review | Spec Reviewer | 審查結論 |
121|| Phase 5 | 動態驗證與即時修復 | Verification Agent | 驗證報告 |
122|
123|### 3.2 Full Mode 各階段詳述
124|
125|**Phase 1 — 需求討論與定義**
126|
127|Main Agent 以對話方式引導用戶逐步釐清需求，涵蓋範圍邊界、用戶場景、技術約束、業務價值等面向。所有模糊點需在進入下一階段前解決。產出 SPEC.md（業務規格書，含 BDD 格式的驗收條件）與 DESIGN.md（技術設計文件）。
128|
129|**Phase 2 — 需求拆分與任務計劃**
130|
131|Planner Agent 以獨立 context 運作，只讀取 Phase 1 產出的 SPEC.md 與 DESIGN.md，不繼承與用戶的對話歷史。其職責包括：
132|- 將設計拆解為 N 個「足夠簡單」的任務，每個任務的粒度應使 worker agent 不需大量思考即可執行
133|- 定義任務之間的依賴關係
134|- 根據檔案重疊情況決定平行化策略
135|- 組成執行批次並排定順序
136|
137|產出 plan/*.md（各 worker 的自包含任務指令）與批次排程資料（batch 順序、各 batch 包含哪些 worker、各 batch 的驗證閘門）。Coordinator 直接程式化讀取此資料進行調度，無需額外的協調者 prompt。
138|
139|**Phase 3 — 批次執行**
140|
141|Coordinator 依照 Phase 2 的批次計劃調度 worker：
142|
143|- 每個 Worker 在獨立的 git worktree 中作業
144|- Worker 完成後觸發專屬的 Reviewer Agent（僅看此 worker 的修改）
145|- Review 未通過 → Fixer Agent（收到修復計劃 + 上輪程式碼）→ 再次 Review，循環直至通過
146|- Review 通過後 → Simplifier Agent → 任務完成
147|- 批次內所有 Worker 完成後 → Batch Final Review（檢查跨任務整合）
148|  - 通過 → 合併回主分支
149|  - 未通過 → Batch Fixer（收到所有計劃文檔 + 起點 versus 最終的 clean diff）→ Review 循環直至通過
150|
151|**Phase 4 — 最終 Spec Review**
152|
153|Spec Reviewer 取得原始 SPEC.md + DESIGN.md，以及所有批次開始前 versus 全部完成後的 clean diff，審查整體架構一致性與 spec 滿足度。未通過時由 Spec Fixer 進行修復，循環直至通過。
154|
155|**Phase 5 — 動態驗證與即時修復**
156|
157|Verification Agent 為最後一道品質閘門：
158|- 讀取 SPEC.md 提取所有 BDD 驗收條件
159|- 透過 bash 命令操作實際運行的應用程式，逐條驗證
160|- 驗證失敗時由 Verification Fixer 進行即時修復，修復後再次驗證
161|- 循環直至全部通過
162|
163|---
164|
165|## 4. 業務邏輯架構
166|
167|### 4.1 通用 Agent 抽象模型
168|
169|系統中所有 agent 角色均透過同一套工廠方法實例化，差異僅來自三個維度的配置：
170|
171|| 配置維度 | 說明 | 範例 |
172||---------|------|------|
173|| **System Prompt** | 角色定義、行為規則、輸出格式 |「你是審查 agent，只讀不寫」|
174|| **Context** | 輸入資訊的範圍與來源 |「這份 diff + 對應的計劃文檔」|
175|| **Tools** | 允許使用的工具集合 |「唯讀模式：read + bash（不寫檔案）」|
176|
177|此設計確保行為由文件驅動而非程式碼驅動，新增角色只需撰寫新的 system prompt 與配置組合，無需新增程式碼檔案。
178|
179|### 4.2 角色與配置總表
180|
181|| # | 角色 | 所屬模式/階段 | 模型層級 | System Prompt 定位 | Context | Tools |
182||---|------|-------------|---------|-------------------|---------|-------|
183|| 1 | **Main Agent** | Full Mode Phase 1 | Coordinator | 需求引導 agent | 用戶對話歷史 | 檔案讀寫（限 SPEC/DESIGN） |
184|| 2 | **Planner Agent** | Full Mode Phase 2 | Coordinator | 任務計畫 agent | SPEC.md + DESIGN.md | 檔案讀寫 + 搜尋 |
185|| 3 | **Planner Agent** | Agent Mode Step 2 | Coordinator | 提煉與規劃 agent | 實作 agent 完整上下文 | 檔案讀取 + 搜尋 |
186|| 4 | **Worker Agent** | Full Mode Phase 3 | Worker | 開發實作 agent | 自己的 plan/*.md + 相關程式碼 | 讀寫編輯 + 命令執行 |
187|| 5 | **Reviewer Agent** | Phase 3 Worker 層 | Coordinator | 審查 agent（唯讀） | 目標 diff + 對應計劃 | 唯讀 |
188|| 6 | **Fixer Agent** | Phase 3 Worker 層 | Worker | 修復 agent | 審查計劃 + 上輪程式碼 | 讀寫編輯 + 命令執行 |
189|| 7 | **Simplifier Agent** | Phase 3 Worker 層 | Worker | 簡化 agent | clean diff | 讀寫編輯 + 命令執行 |
190|| 8 | **Batch Reviewer** | Phase 3 Batch 層 | Coordinator | 批次審查 agent | 所有計劃文檔 + batch clean diff | 唯讀 |
191|| 9 | **Batch Fixer** | Phase 3 Batch 層 | Worker | 批次修復 agent | 計劃文檔 + clean diff + 審查計劃 | 讀寫編輯 + 命令執行 |
192|| 10 | **Spec Reviewer** | Phase 4 | Coordinator | 規格審查 agent | SPEC.md + DESIGN.md + spec clean diff | 唯讀 |
193|| 11 | **Spec Fixer** | Phase 4 | Worker | 規格修復 agent | SPEC.md + DESIGN.md + clean diff + 審查計劃 | 讀寫編輯 + 命令執行 |
194|| 12 | **Verification Agent** | Phase 5 | Coordinator | 驗證 agent（不寫檔案） | SPEC.md BDD + clean diff | 僅命令執行 |
195|| 13 | **Verification Fixer** | Phase 5 | Worker | 驗證修復 agent | 驗證 context + 失敗證據 | 讀寫編輯 + 命令執行 |
196|
197|### 4.3 Context 邊界策略
198|
199|Context 邊界為本系統 token 經濟的核心機制。各層級 agent 所見的資訊範圍嚴格限制：
200|
201|**Worker 層級：**
202|- Worker 僅見自己的計劃文檔與相關程式碼
203|- Reviewer 僅見同一 worker 的修改 diff
204|- Fixer 在前次 reviewer 所見的基礎上疊加修復
205|- Simplifier 僅見最終修改集，不包含過程中的 fix 痕跡
206|
207|**Batch 層級：**
208|- Batch Reviewer 與 Batch Fixer 僅見「起點 versus 最終」的 clean diff
209|- 不包含任何 worker 內部的 review、fix、simplify 過程
210|- 此為跨層級 token 節省的核心機制
211|
212|**Spec 層級：**
213|- Spec Reviewer 與 Spec Fixer 僅見全專案 clean diff 與 SPEC/DESIGN 文件
214|- 不帶批次內部的執行細節
215|
216|**Verification 層級：**
217|- Verification Agent 僅見 SPEC.md 的 BDD 驗收條件
218|- 不讀取任何程式碼，僅透過 bash 操作應用程式
219|
220|### 4.4 Review-Fix 循環設計
221|
222|系統設有四層 review-fix 循環，由內向外形成品質防護網：
223|
224|**第一層 — Worker 層（最內層）：**
225|Reviewer 發現問題 → Fixer 收到審查計劃與上輪程式碼 → 修復 → Reviewer 再次審查（疊加 fixer 修改）→ 循環直至通過 → Simplifier
226|
227|**第二層 — Batch 層：**
228|批次內所有 worker 完成後 → Batch Final Review → 發現跨任務整合問題 → Batch Fixer（收到 clean diff + 審查計劃）→ Review 循環直至通過
229|
230|**第三層 — Spec 層：**
231|全部批次完成後 → Spec Review（對照原始 SPEC/DESIGN）→ 發現 spec 滿足度問題 → Spec Fixer → 循環直至通過
232|
233|**第四層 — Verification 層（最外層）：**
234|Verification Agent 執行 BDD 驗證 → 發現驗證失敗 → Verification Fixer 收到失敗證據 → 修復 → 重新驗證 → 循環直至全部通過
235|
236|每輪 reviewer 所見的修改範圍只增不減（第一輪見原始修改，第二輪見原始加 fixer 首輪修改，第三輪再加 fixer 第二輪修改），確保審查的完整性。
237|
238|### 4.6 Full Mode Agent 間傳導欄位
239|
240|Full Mode 各 agent 之間透過結構化 JSON 傳遞資料，所有 JSON 皆經 Zod schema 驗證後才傳遞。傳遞由 Runtime 程式化調度，不經由 LLM agent 中介。
241|
242|以下按傳遞方向列出各階段的 schema。`→` 左側為生產者，右側為消費者；Runtime 負責中介與 schema 驗證。
243|
244|---
245|
246|#### Phase 1：Main Agent → Planner Agent
247|
248|Main Agent 與用戶對話後產出，同時渲染為 SPEC.md / DESIGN.md 供人類審閱：
249|
250|```json
251|{
252|  "spec": {
253|    "title": "功能名稱",
254|    "goal": "業務目標",
255|    "requirements": [
256|      {
257|        "id": "REQ-1",
258|        "description": "需求描述",
259|        "bdd": { "given": "前提條件", "when": "操作", "then": "預期結果" }
260|      }
261|    ],
262|    "out_of_scope": ["不在此範圍的事項"],
263|    "constraints": ["技術/時程/法規約束"]
264|  },
265|  "design": {
266|    "modules": [
267|      {
268|        "name": "模組名稱",
269|        "responsibility": "職責描述",
270|        "files": ["src/xxx.ts"],
271|        "dependencies": ["其他模組"]
272|      }
273|    ],
274|    "external_dependencies": [
275|      { "name": "套件/API 名稱", "purpose": "用途" }
276|    ]
277|  }
278|}
279|```
280|
281|---
282|
283|#### Phase 2：Planner Agent → Runtime
284|
285|```json
286|{
287|  "batches": [
288|    {
289|      "id": "B1",
290|      "order": 1,
291|      "workers": ["W1", "W2"],
292|      "parallel": true,
293|      "depends_on": [],
294|      "gate": "所有 worker 皆有 review ✅"
295|    },
296|    {
297|      "id": "B2",
298|      "order": 2,
299|      "workers": ["W3"],
300|      "parallel": false,
301|      "depends_on": ["B1"],
302|      "gate": "worker review ✅ + batch integration ✅"
303|    }
304|  ],
305|  "workers": {
306|    "W1": {
307|      "task_id": "T1",
308|      "plan": "自包含任務描述，含檔案路徑與修改範圍",
309|      "affected_files": ["src/auth.ts"],
310|      "verification": "如何驗證此任務正確",
311|      "model_tier": "worker"
312|    }
313|  }
314|}
315|```
316|
317|---
318|
319|#### Phase 3 Worker 層內循環
320|
321|**Runtime → Worker Agent：**
322|```json
323|{
324|  "task_id": "T1",
325|  "plan": "自包含任務指令",
326|  "allowed_files": ["src/auth.ts", "src/session.ts"],
327|  "worktree": "worktree-t1"
328|}
329|```
330|
331|**Worker Agent → Runtime：**
332|```json
333|{
334|  "task_id": "T1",
335|  "status": "completed",
336|  "changed_files": ["src/auth.ts", "src/session.ts"],
337|  "summary": "實作摘要",
338|  "diff_ref": "worktree commit hash"
339|}
340|```
341|
342|**Runtime → Reviewer Agent：**
343|```json
344|{
345|  "task_id": "T1",
346|  "plan": "原始任務計劃",
347|  "diff": "行級 diff 資料",
348|  "changed_files": ["src/auth.ts"]
349|}
350|```
351|
352|**Reviewer Agent → Runtime（審查 verdict）：**
353|```json
354|{
355|  "task_id": "T1",
356|  "verdict": "pass | fail",
357|  "findings": [
358|    {
359|      "severity": "P0 | P1 | P2 | P3",
360|      "description": "問題描述",
361|      "file": "src/auth.ts",
362|      "line": 42,
363|      "suggestion": "修正建議"
364|    }
365|  ]
366|}
367|```
368|
369|**Runtime → Fixer Agent（verdict 為 fail 時）：**
370|```json
371|{
372|  "task_id": "T1",
373|  "findings": [/* 來自 Reviewer 的 finding 清單 */],
374|  "code_context": "修改前的原始程式碼",
375|  "allowed_files": ["src/auth.ts"]
376|}
377|```
378|
379|**Fixer Agent → Runtime：**
380|```json
381|{
382|  "task_id": "T1",
383|  "status": "fixed",
384|  "changes": ["修正內容摘要"]
385|}
386|```
387|
388|**Runtime → Simplifier Agent（review 通過後）：**
389|```json
390|{
391|  "task_id": "T1",
392|  "clean_diff": "起點 vs 最終（不包含 fix 中間痕跡）",
393|  "changed_files": ["src/auth.ts"]
394|}
395|```
396|
397|**Simplifier Agent → Runtime：**
398|```json
399|{
400|  "task_id": "T1",
401|  "status": "simplified",
402|  "original_lines": 120,
403|  "simplified_lines": 95,
404|  "test_status": "passed"
405|}
406|```
407|
408|---
409|
410|#### Phase 3 Batch 層
411|
412|**Runtime → Batch Reviewer（批次內所有 worker ✅ 後）：**
413|```json
414|{
415|  "batch_id": "B1",
416|  "workers": ["W1", "W2"],
417|  "worker_summaries": [/* 各 worker 的 summary */],
418|  "clean_diff": "批次開始前 vs 所有 worker 完成後",
419|  "task_plans": [/* 所有任務的計劃 */]
420|}
421|```
422|
423|**Batch Reviewer → Runtime：**
424|```json
425|{
426|  "batch_id": "B1",
427|  "verdict": "pass | fail",
428|  "findings": [
429|    {
430|      "severity": "P0 | P1 | P2",
431|      "description": "跨任務整合問題",
432|      "involving_workers": ["W1", "W2"],
433|      "suggestion": "修正建議"
434|    }
435|  ]
436|}
437|```
438|
439|**Runtime → Batch Fixer（verdict 為 fail 時）：**
440|```json
441|{
442|  "batch_id": "B1",
443|  "findings": [/* 來自 Batch Reviewer */],
444|  "clean_diff": "同 reviewer 所見（無 worker 內部痕跡）",
445|  "task_plans": [/* 所有任務計劃 */]
446|}
447|```
448|
449|**Batch Fixer → Runtime：**
450|```json
451|{
452|  "batch_id": "B1",
453|  "status": "fixed",
454|  "changes": ["修正摘要"]
455|}
456|```
457|
458|---
459|
460|#### Phase 4：Spec 層
461|
462|**Runtime → Spec Reviewer（所有批次完成後）：**
463|```json
464|{
465|  "spec": "原始 SPEC 資料",
466|  "design": "原始 DESIGN 資料",
467|  "clean_diff": "全專案開始前 vs 全部批次完成後"
468|}
469|```
470|
471|**Spec Reviewer → Runtime：**
472|```json
473|{
474|  "verdict": "pass | fail",
475|  "findings": [
476|    {
477|      "severity": "P0 | P1",
478|      "description": "spec 未滿足項目",
479|      "requirement_id": "REQ-1",
480|      "suggestion": "修正建議"
481|    }
482|  ]
483|}
484|```
485|
486|**Runtime → Spec Fixer（verdict 為 fail 時）：**
487|```json
488|{
489|  "findings": [/* 來自 Spec Reviewer */],
490|  "clean_diff": "同 reviewer 所見",
491|  "spec": "原始 SPEC",
492|  "design": "原始 DESIGN"
493|}
494|```
495|
496|**Spec Fixer → Runtime：**
497|```json
498|{
499|  "status": "fixed",
500|  "changes": ["修正摘要"]
501|