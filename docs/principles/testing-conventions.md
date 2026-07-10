# 測試慣例

## 測試框架

使用 pytest 作為測試框架。在 `pyproject.toml` 中配置：

```toml
[tool.pytest.ini_options]
pythonpath = [".."]
testpaths = ["tests"]
```

`pythonpath = [".."]` 讓 `from jovaltus import ...` 可以正確解析（因為 repo root 就是 `jovaltus` package）。

*來源：pyproject.toml:14-16*

## 測試目錄結構

所有測試檔案集中在 `tests/` 目錄：
- `tests/conftest.py` — 共用 fixture
- `tests/test_state.py` — state module 測試
- `tests/test_git_utils.py` — git_utils module 測試
- `tests/test_schemas.py` — schemas module 測試
- `tests/test_tools.py` — tool handlers 測試

*來源：tests/ 目錄結構*

## 共用 Fixture

`conftest.py` 提供兩個 fixture：

### `clear_task_state`（autouse）
每個 test 前自動清除 task state，避免測試間互相干擾。

*來源：tests/conftest.py:11-15*

### `git_repo`
建立一個包含初始 commit 的臨時 git repository。使用 `tmp_path` 確保測試隔離。

*來源：tests/conftest.py:18-39*

**理由**: 兩個 test 檔（`test_git_utils.py` 和 `test_tools.py`）都需要 git repo fixture，提取至 conftest 避免重複。

## State 測試

測試 task 生命週期：建立 → 讀取 → 計數 → 清除。同時測試執行緒安全（50 個 concurrent thread）。

*來源：tests/test_state.py*

## Git Utils 測試

使用真實 git repository（非 mock）測試所有 git 操作：
- `is_git_repo`（true/false）
- `get_head_hash`（完整 SHA）
- `get_diff`（無變更/有變更）
- `get_diff_stat`（結構化資料）
- `stage_all` + `commit`（成功/無變更）

*來源：tests/test_git_utils.py*

## Tools 測試

使用 `unittest.mock.MagicMock` 取代 `ctx`，不依賴 Hermes runtime：
- 測試非 git repo 錯誤路徑
- 測試不存在的 task_id
- 測試成功路徑（驗證 dispatch_tool 被呼叫）
- 驗證 prompt 檔案存在且非空

*來源：tests/test_tools.py*

**理由**: Mock ctx 讓 handler 測試可以在沒有 Hermes 完整環境的情況下執行。dispatch_tool 的呼叫與引數可被驗證。

## 執行測試

```bash
uv run pytest -v
```

全部 25 個測試在 ~1.2 秒內完成。
