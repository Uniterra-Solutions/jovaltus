# Agent Mode Pipeline

## 實作階段（Implement）

- **Given** 用戶已與 main agent 確認需求
- **When** main agent 呼叫 `jovaltus_implement` 工具
- **Then** 一個 implement subagent 被啟動，具有 terminal 與 file 存取權限
- **And** subagent 讀取 `prompts/implement.md` 作為系統提示
- **And** subagent 修改或建立程式碼後自動執行 `git add -A && git commit`
- **And** handler 回傳 `task_id` 供後續階段使用
- **And** 若目錄不是 git repo，回傳錯誤提示

*來源：tools.py:62-70（dispatch delegate_task）、tools.py:46-53（非 git repo 錯誤）、prompts/implement.md（subagent 提示）*

## 驗證與修復階段（Verify & Fix）

- **Given** implement 階段已完成，且 `task_id` 已知
- **When** main agent 呼叫 `jovaltus_verify` 並傳入 `task_id`
- **Then** handler 計算 baseline commit 到 HEAD 的 git diff
- **And** 一個 verification subagent 被啟動，具有 **寫入** 權限
- **And** subagent 以 adversary 心態執行測試、尋找 bug、直接修復
- **And** subagent 執行 verify → fix → re-verify 閉環直到全部通過
- **And** 完成後自動 commit

*來源：tools.py:102-132（計算 diff + dispatch subagent）、schemas.py:35-63（task_id required）、prompts/verify.md（adversarial 提示）*

## 簡化階段（Simplify）

- **Given** 驗證階段已完成，且 `task_id` 已知
- **When** main agent 呼叫 `jovaltus_simplify` 並傳入 `task_id`
- **Then** handler 計算 baseline 到 HEAD 的 clean diff
- **And** 一個 simplifier subagent 被啟動
- **And** subagent 按優先級執行：提取重複 > 刪除死亡程式碼 > 展平巢狀 > 改善命名
- **And** 任何刪除前必須有 grep 證據
- **And** 行為嚴格不變，完成後自動 commit

*來源：tools.py:156-186、schemas.py:65-94、prompts/simplify.md*

## 規劃階段（Phase 0 — Main Agent 執行）

此階段不由 plugin 工具處理，而是由 main agent 根據 `skills/jovaltus-agent/SKILL.md` 指引執行。

- **Given** 用戶提出需求
- **When** main agent 尚未開始實作
- **Then** main agent 使用 `clarify` 進行輪次提問（scope → 業務流程 → 約束條件 → 商業價值）
- **And** 建立業務需求檢查清單
- **And** 使用 `web_search` 查詢最新資料 [INFERRED]
- **And** 等待用戶確認後才進入 Phase 1

*來源：skills/jovaltus-agent/SKILL.md:17-31*
