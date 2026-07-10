# Plugin 三層架構設計

Jovaltus plugin 採用三層分離架構，每一層有獨立的職責與變更頻率。

## 第一層：Skill 文件（流程指引）

**原則**: Skill 文件只描述「要做什麼」，不寫工具名稱，不寫程式碼細節。

Skill 文件位於 `skills/jovaltus-agent/SKILL.md`，由 main agent 在 session 啟動時載入。
Main agent 根據 Skill 指引決定何時呼叫哪個 plugin tool。

*來源：skills/jovaltus-agent/SKILL.md（完整流程定義）*

**設計理由**: LLM 的閱讀理解能力決定流程執行品質。將流程描述與實作分離，讓修改流程不需要改 Python 程式碼。

## 第二層：Tool Handler（薄 Python 層）

**原則**: Handler 只負責狀態管理 + 調度 subagent，不做管線控制。

每個 handler 是一個 closure，在 `register()` 中捕獲 `ctx`（Hermes plugin context）：

```
register() → make_*_handler(ctx) → handler(args, **kwargs) → str
```

Handler 的三個職責：
1. 記錄狀態（git hash、task_id）→ `state.py` + `git_utils.py`
2. 讀取 subagent system prompt → `prompts/*.md`
3. 透過 `ctx.dispatch_tool("delegate_task", ...)` 啟動 subagent

*來源：__init__.py:70-87（register() 建立 closure）、tools.py（三個 factory function）*

**設計理由**: Tool handler 無法直接呼叫 `delegate_task`（那是 LLM 層級的 tool），但可以透過 Hermes 提供的 `ctx.dispatch_tool()` API 來調用。這讓 handler 保持薄層，不做需要 LLM 判斷的決策。

## 第三層：Subagent Prompt（獨立提示文件）

**原則**: 每個 subagent 的行為由獨立 markdown 檔案定義，與 Python 程式碼完全分離。

三個 prompt 檔案位於 `prompts/` 目錄：
- `prompts/implement.md` — Implement subagent 的系統提示
- `prompts/verify.md` — Verification subagent（adversarial 心態）的系統提示
- `prompts/simplify.md` — Simplifier subagent 的系統提示

每個 prompt 被 tool handler 在 factory function 建立時讀取一次（`_read_prompt()`，tools.py:25-31），並在 dispatch 時作為 `goal` 參數傳入 `delegate_task`。

*來源：tools.py:25-31（_read_prompt 實作）、tools.py:44（implement handler 讀取 prompt）、tools.py:89（verify handler 讀取 prompt）、tools.py:143（simplify handler 讀取 prompt）*

**設計理由**: Subagent 的行為調整只需要編輯 markdown 檔案，不需要修改 Python 程式碼。降低修改門檻，也減少出錯機會。

## Plugin 註冊流程

```
Hermes 啟動
    │
    ├── 讀取 plugins.enabled 設定
    ├── 載入 ~/.hermes/profiles/<profile>/plugins/jovaltus/__init__.py
    ├── 呼叫 register(ctx)
    │       ├── ctx.register_tool() × 3（implement, verify, simplify）
    │       ├── ctx.register_cli_command("jovaltus", ...)
    │       └── ctx.register_skill("jovaltus-agent", ...) for skills/jovaltus-agent/SKILL.md
    └── 工具、CLI 命令、技能就緒
```

*來源：__init__.py:62-104（register() 完整實作）*
