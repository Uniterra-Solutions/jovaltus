# Tool Handler 調度 Subagent 機制

## 設計原則

每個 tool handler 在 main agent 呼叫時，透過 `ctx.dispatch_tool()` 啟動一個背景 subagent。
Handler 立即回傳 task_id，subagent 在背景非同步執行。

## 調度流程

```
Main agent calls jovaltus_implement({project_dir})
    │
    ├── handler 檢查是否為 git repo（git_utils.is_git_repo）
    │   └── 失敗 → 回傳 {"error": "Not a git repository"}
    │
    ├── handler 記錄 HEAD hash + 建立 task（state.create_task）
    │
    ├── handler 讀取 prompts/implement.md（_read_prompt）
    │
    ├── handler 呼叫 ctx.dispatch_tool("delegate_task", {
    │       goal = prompt 內容,
    │       context = project info,
    │       toolsets = ["terminal", "file"],
    │   })
    │   └── delegate_task 立即回傳，subagent 在背景執行
    │
    └── handler 回傳 {"task_id": "jt-...", "subagent": "spawned"}
```

*來源：tools.py:46-84（implement_handler 完整實作）*

## Handler Factory 模式

三個 handler 都使用相同的 factory 模式：

```python
def make_implement_handler(ctx):
    prompt = _read_prompt("implement")     # 建立時讀取 prompt

    def handler(args: dict, **kwargs) -> str:
        # 執行時期邏輯：檢查狀態、dispatch subagent、回傳 JSON
        ...

    return handler
```

*來源：tools.py:42-84（implement handler factory）、tools.py:87-138（verify handler factory）、tools.py:141-192（simplify handler factory）*

## Handler 簽名規則

每個 handler 必須：
1. 接受 `(args: dict, **kwargs)` 作為參數
2. 回傳 JSON 字串（成功或錯誤）
3. 捕獲所有例外，回傳錯誤 JSON 而非拋出

*來源：tools.py:46、tools.py:80-82（例外處理）*

## Subagent 配置

| 面向 | Implement | Verify | Simplify |
|------|-----------|--------|----------|
| toolsets | terminal, file | terminal, file | terminal, file |
| 寫入權限 | ✅ | ✅ | ✅ |
| 自我驗證 | ❌ | ✅（閉環） | ❌ |
| 自我 commit | ✅ | ✅ | ✅ |
| Prompt 來源 | prompts/implement.md | prompts/verify.md | prompts/simplify.md |

*來源：tools.py:62-70（implement）、tools.py:109-122（verify）、tools.py:163-175（simplify）*
