# 錯誤處理模式

## Handler 錯誤處理

所有 tool handler 必須捕獲所有例外，回傳 JSON 錯誤字串而非拋出例外。

```python
try:
    # handler logic
    return json.dumps({...})
except Exception as e:
    logger.exception("jovaltus_xxx failed")
    return json.dumps({"error": str(e)})
```

*來源：tools.py:80-82（implement_handler）、tools.py:134-136（verify_handler）、tools.py:188-190（simplify_handler）*

**理由**: Hermes tool call loop 期望 handler 回傳字串。拋出例外會中斷 plugin 載入或 tool 執行。

## Git 操作錯誤處理

`git_utils.py` 中的 git 命令使用 try/except 處理已知錯誤：

- `is_git_repo`: 捕獲 `CalledProcessError` 和 `FileNotFoundError`，回傳 `False` 而非拋出。
- `get_diff` / `get_diff_stat`: 捕獲 `CalledProcessError`，包裝為 `RuntimeError` 並帶有 stderr 訊息。

*來源：git_utils.py:18-25（is_git_repo）、git_utils.py:39-42（get_diff）、git_utils.py:53-56（get_diff_stat）*

**理由**: 讓 handler 層可以統一捕獲上層例外，避免 handler 需要處理多種 git 錯誤類型。

## 輸入驗證

Handler 在執行主要邏輯前進行輸入驗證：

1. **implement handler**: 檢查 `project_dir` 是否為 git repository（tools.py:49-53）
2. **verify handler**: 檢查 `task_id` 是否存在於 state（tools.py:95-100）
3. **simplify handler**: 同上（tools.py:149-154）

無效輸入回傳包含 `"error"` 鍵和 `"hint"` 鍵的 JSON，協助 LLM 理解錯誤原因並修正。

*來源：tools.py:49-53（非 git repo 錯誤訊息含 hint）、tools.py:97-99（task 不存在的錯誤訊息）*

## 錯誤 JSON 格式

所有錯誤回應使用統一格式：

```json
{"error": "描述錯誤原因的訊息", "hint": "可選的修正建議"}
```

成功回應使用每個 handler 自訂的鍵值結構，但都包含 `"task_id"`、`"subagent": "spawned"`、`"phase"`。
