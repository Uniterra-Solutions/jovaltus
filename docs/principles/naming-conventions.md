# 命名慣例

## Plugin 檔案命名

Plugin 的根目錄必須包含 `plugin.yaml` 和 `__init__.py`，這是 Hermes plugin 載入機制的要求。
輔助模組使用蛇形命名（snake_case）：`tools.py`、`state.py`、`git_utils.py`、`schemas.py`。

*來源：plugin.yaml、__init__.py*

**範例**：
```
jovaltus/
├── plugin.yaml         # Hermes plugin manifest（固定名稱）
├── __init__.py         # register() entry point（固定名稱）
├── tools.py            # tool handler factories
├── state.py            # task state management
├── git_utils.py        # git subprocess wrappers
└── schemas.py          # tool JSON schemas
```

## Tool 命名

Tool 名稱使用前綴 `jovaltus_` + 階段名稱：
- `jovaltus_implement`
- `jovaltus_verify`
- `jovaltus_simplify`

*來源：schemas.py:10、schemas.py:35、schemas.py:65*

**理由**: 前綴確保在 Hermes 工具列表中可以快速識別 plugin 提供的工具，且與 built-in tools 不衝突。

## Handler Factory 命名

Factory function 使用 `make_` + 階段名稱 + `_handler`：
- `make_implement_handler`
- `make_verify_handler`
- `make_simplify_handler`

*來源：tools.py:42、tools.py:87、tools.py:141*

**理由**: 清晰的 factory 命名讓 `register()` 中的註冊邏輯一目瞭然。

## Subagent Prompt 檔案命名

Prompt 檔案使用階段名稱直接命名，不綴加 `_prompt`：
- `prompts/implement.md`
- `prompts/verify.md`
- `prompts/simplify.md`

*來源：tools.py:25-31（_read_prompt 從 prompts/<name>.md 讀取）*

## Test 檔案命名

測試檔案使用 `test_` + 被測模組名稱：
- `test_state.py`
- `test_git_utils.py`
- `test_schemas.py`
- `test_tools.py`

公用 fixture 集中在 `conftest.py`。

*來源：tests/ 目錄結構*

**理由**: 符合 pytest 的自動發現慣例，無需額外設定。
