# Git 狀態管理與 Diff 計算

## 設計原則

所有 git 操作透過 `git_utils.py` 封裝為純函式，以 `repo_path` 參數決定目標目錄。
預設值為當前工作目錄，讓 handler 不需要明確傳入路徑。

## 核心函式

### `is_git_repo(repo_path)`
檢查目錄是否在 git repository 內。使用 `git rev-parse --git-dir`。失敗時回傳 `False`（捕獲 `CalledProcessError` 和 `FileNotFoundError`）。

*來源：git_utils.py:18-25*

### `get_head_hash(repo_path)`
回傳 HEAD 的完整 40 字元 SHA。使用 `git rev-parse HEAD`。

*來源：git_utils.py:28-31*

### `get_diff(start_hash, end, repo_path)`
計算兩個 git ref 間的 diff。使用 `git diff <start_hash> <end>`。預設 `end = "HEAD"`。

*來源：git_utils.py:34-42*

### `get_diff_stat(start_hash, end, repo_path)`
回傳變更檔案的結構化列表（path, additions, deletions）。使用 `git diff --numstat`。

*來源：git_utils.py:52-69*

### `stage_all(repo_path)`
暫存所有變更。使用 `git add -A`。由 subagent 在 commit 前呼叫。

*來源：git_utils.py:72-75*

### `commit(message, repo_path)`
提交暫存變更。使用 `git commit -m <message>`。回傳 `{"success": bool, "message": str}`。

*來源：git_utils.py:78-86*

## Git 命令安全性

所有 git 命令使用 list args 而非 `shell=True`，避免 shell injection 風險。

*來源：git_utils.py（所有函式都使用 list args）*

## 狀態與 Diff 的生命週期

```
Phase 1 (Implement)
    │  impl_handler: get_head_hash → 存入 state
    │  subagent: 寫程式 → git add → git commit
    ▼
Phase 2 (Verify)
    │  verify_handler: get_diff(start_hash, HEAD)
    │  subagent: 跑測試 → 修 bug → git add → git commit
    ▼
Phase 3 (Simplify)
    │  simplify_handler: get_diff(start_hash, HEAD)
    │  subagent: 重構 → git add → git commit
    ▼
完成
```

## Task State

狀態儲存在 module-level 的 `_tasks` dict（`state.py:14`），使用 `threading.Lock()` 確保執行緒安全。

每個 task 記錄：
- `task_id`: 唯一識別碼（timestamp + counter）
- `project_dir`: git repo 絕對路徑
- `start_hash`: baseline commit hash
- `created_at`: Unix timestamp

*來源：state.py:10-51*
