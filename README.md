# Jovaltus — Hermes Plugin for Subagent-Driven Development

> **Jovaltus** is a Hermes plugin that implements a deterministic,
> subagent-driven development framework: 4 tools (`plan`, `execute`,
> `simplify`, `review`) dispatch isolated subagents through a plugin-owned
> state machine, and 3 hooks drive phase transitions automatically and
> inject pipeline status every turn. It also bundles 5 utility skills.

---

## Documentation

Full project documentation lives in **[docs/](docs/README.md)** — architecture,
conventions, project structure, testing, workflows, and setup guides.

---

## Overview

v1.0.0 rearchitected Jovaltus from a skill-bundle approach into a
**subagent-driven deterministic framework**. The plugin ships 4 tools whose
handlers dispatch pipeline subagents via Hermes's `subagent_lifecycle` (resolved from the
main-agent turn and cached for hook-driven continuation);
a state machine (`state.py`, persisted to `~/.hermes/jovaltus_state.json`)
records every phase transition (cross-session resume); and 3 hooks
(`subagent_start`, `subagent_stop`, `pre_llm_call`) associate children,
advance the chain, and inject a status line into every turn.

```
plan → execute → simplify → review
```

The main agent does NOT decide pipeline flow — it calls tools and reads
status. Every phase is one isolated subagent whose goal comes from
`src/jovaltus/prompts/*.md`.

---

## The Tools

### `plan` — Build the Task DAG

Call with `user_requirements`. Dispatches subagents in sequence:
prd → research → acceptance → tasks. Each writes an artifact into
`.plan/<YYYYmmdd>/<plan_name>/` (`prd.md`, `design.md`, `acceptance.md`,
`tasks.md`). `tasks.md` is the task DAG manifest: serial / batch /
fully-parallel forms expressed as a mermaid DAG.

### `execute` — Implement the DAG

Call with `plan` (path to a `tasks.md` manifest). Dispatches an
**orchestrator subagent** that drives every task level by level —
same-level tasks in parallel. Requires `delegation.max_spawn_depth >= 2`
in the Hermes config. The orchestrator does NOT commit: the diff is left
for simplify/review.

### `simplify` — Simplify the Changes

Call with `plan`. Dispatches a simplification-review subagent, then a
fixer, looping until the reviewer writes `verdict.json` with `"pass"`.
No iteration cap.

### `review` — Adversarially Review the Changes

Call with `plan`. Same loop shape, but the reviewer tries to BREAK the
changes (bugs, assumptions, edge cases) instead of seeking simplification.

Every dispatched child's goal carries the marker
`[jovaltus-pipeline:<tool>:<phase>]`; `subagent_stop` advances the chain,
and `pre_llm_call` injects `[Jovaltus pipeline] tool=... phase=...
status=... run_dir=...` each turn while a pipeline exists.

---

## Bundled Skills (5 utility)

| Skill | Type | Purpose |
|-------|------|---------|
| `agentic-debugging` | Utility | 5-phase evidence-driven debugging |
| `manage-agents-md` | Utility | AGENTS.md creation, audit, maintenance |
| `manage-git-repo` | Utility | Commit, version release, branch+PR, stacked PR |
| `project-documentation` | Utility | Multi-file docs/ tree generation + root README sync |
| `qa` | Utility | Standalone PRD-driven acceptance testing |

The bundled skills are standalone utilities — pipeline phases live in
`src/jovaltus/prompts/*.md`, not in skills.

---

## Installation and Usage

### Step 1: Install the Plugin

```bash
pip install jovaltus && hermes plugins enable jovaltus
```

> `fabricium` 會作為依賴自動安裝。

### Step 2: Setup

```bash
# 一鍵安裝 — 互動式 prompts (TTY detection, 非互動環境用預設值)
hermes jovaltus setup
```

Setup 會：

1. 建立 `jovaltus-agent` profile（如不存在）
2. 安裝 bundled skills 到 global skills 目錄
3. 寫入 SOUL.md（可選，預設 yes）
4. 記錄安裝狀態至 `~/.hermes/jovaltus_state.json`

### Step 3: 啟用 Plugin

```bash
hermes plugins enable jovaltus
```

### Step 4: 建立 Profile

```bash
hermes jovaltus setup
```

> Profile 建立後，編輯 `~/.hermes/profiles/jovaltus-agent/config.yaml`，
> 確認 model 設定與 root config 一致：
> ```yaml
> model:
>   default: deepseek-v4-flash
>   provider: deepseek
> ```

### Step 5: 連結 Plugin 到 Profile

```bash
ln -s /Users/tszkinlai/uniterra/jovaltus ~/.hermes/profiles/jovaltus-agent/plugins/jovaltus
```

> 當使用 `hermes -p <profile>` 啟動 session 時，Hermes 只掃描 profile
> 目錄底下的 plugins。Plugin 必須存在於 profile 的 plugins 子目錄中。

### Step 6: 確認安裝

```bash
hermes -p jovaltus-agent
# 在 session 中輸入：
# 「list all tools from the jovaltus plugin」
# 應該看到 plan / execute / simplify / review 四個 tools
```

### 日常使用

```bash
# 查詢安裝狀態
hermes jovaltus status

# 檢查更新
hermes jovaltus update --check

# 套用更新（自動清理過時 skill、同步 SOUL.md）
hermes jovaltus update

# 在任何專案目錄下啟動
cd /projects/app-alpha
hermes -p jovaltus-agent
```

### 使用 Pipeline（工具驅動）

```bash
# 1. 啟動 session
hermes -p jovaltus-agent

# 2. 呼叫 plan tool（傳 user_requirements）
#    「call the plan tool with user_requirements='<你的需求>'」
#    → 自動依序派出 prd → research → acceptance → tasks 四個 subagents

# 3. plan 完成後，呼叫 execute tool（傳 tasks.md 路徑）
#    「call the execute tool with plan='.plan/<YYYYmmdd>/<plan_name>/tasks.md'」

# 4. 需要時依序呼叫 simplify / review
#    「call the simplify tool with plan='.plan/<YYYYmmdd>/<plan_name>'」
#    「call the review tool with plan='.plan/<YYYYmmdd>/<plan_name>'」

# 每個 tool 啟動後，pipeline 由 state machine + hooks 自動推進；
# 每輪 turn 都會看到 [Jovaltus pipeline] 狀態行
```

### 疑難排解

| 問題 | 解法 |
|------|------|
| Skills 未出現 | Plugin 未正確載入。檢查 Step 5 的 symlink 是否存在 |
| `No inference provider configured` | Profile config 缺少 model 設定。參考 Step 4 補上 |
| 401 Authentication Error | 確認 profile 的 `.env` 有 API key |
| `Unknown command: jovaltus` | Plugin 未啟用。執行 `hermes plugins enable jovaltus` |
| execute 回傳 `max_spawn_depth` 錯誤 | 設定 `hermes config set delegation.max_spawn_depth 2` |

---

## Architecture

### Subagent-Driven Deterministic Framework

Jovaltus v1.0.0 is a deterministic framework, not a skill bundle. The plugin:

1. **Self-bootstraps** fabricium on import (survives Hermes venv recreation)
2. **Registers CLI commands** via `fabricium.HermesPlugin` (`setup`, `status`, `update`)
3. **Registers 4 tools** (`plan`, `execute`, `simplify`, `review`) via
   `ctx.register_tool` — each handler starts a pipeline and dispatches the
   first-phase subagent
4. **Registers 3 hooks** via `ctx.register_hook` — `subagent_start`
   associates children, `subagent_stop` advances the chain, `pre_llm_call`
   injects status
5. **Persists pipeline state** to `~/.hermes/jovaltus_state.json` under the
   `"pipeline"` key (fabricium-managed; the `"profiles"` key is untouched)

The main agent calls tools and reads status; the state machine + hooks
decide the flow.

### Why This Architecture?

| Old (v0.6.0 skill bundle) | New (v1.0.0 framework) |
|---------------|---------------|
| Bundled skills guide the orchestrator phase by phase | 4 tools + state machine + 3 hooks drive the pipeline |
| Orchestrator navigates skills phase by phase | Deterministic chains: plan (prd→research→acceptance→tasks→done), execute, simplify/review verdict loops |
| No plugin tools, no state machine | 4 tools registered on ctx; `PipelineState` persisted to JSON |
| Behavior in skill documents | Behavior in `prompts/*.md` goal documents + `state.py` + `hooks.py` |
| Subagents spawned by orchestrator following skills | Subagents dispatched by plugin tool handlers + hooks viaa `delegate_task` |

---

## Project Structure

```
jovaltus/
├── README.md
├── AGENTS.md
├── CHANGELOG.md
├── pyproject.toml
├── src/jovaltus/
│   ├── __init__.py          # register(): fabricium + 4 tools + 3 hooks (67 lines)
│   ├── state.py             # Deterministic state machine + JSON persistence
│   ├── tools.py             # 4 tool handlers + CHAIN + dispatch_pipeline_step
│   ├── hooks.py             # subagent_start / subagent_stop / pre_llm_call
│   ├── prompts/             # 9 subagent goal prompts (prd, research, acceptance, tasks, execute, simplify-review, simplify-fix, review, review-fix)
│   ├── plugin.yaml          # Plugin metadata (version 1.0.0)
│   ├── SOUL.md              # Agent identity
│   └── skills/              # 5 bundled utility skills
│       ├── agentic-debugging/
│       ├── manage-agents-md/
│       ├── manage-git-repo/
│       ├── project-documentation/
│       └── qa/
├── tests/
│   ├── test_state.py        # 24 tests
│   ├── test_tools.py        # 18 tests
│   ├── test_hooks.py        # 17 tests
│   ├── test_register.py     # 5 tests
│   ├── test_git_utils.py    # 19 tests
│   ├── test_sync.py         # 8 tests
│   └── integration/
│       └── test_cli.py      # 8 tests
└── docs/                    # Project documentation
```

---

## Technical Decisions

| Aspect | Decision |
|--------|----------|
| **Architecture** | Subagent-driven deterministic framework — tools + state machine + hooks |
| **Pipeline control** | State machine + hooks decide flow; main agent calls tools and reads status |
| **Phase chains** | plan: prd→research→acceptance→tasks→done; execute: execute→done; simplify/review: verdict-driven fix loops (no cap) |
| **State persistence** | `~/.hermes/jovaltus_state.json` (`"pipeline"` key) — cross-session resume |
| **Profile** | `jovaltus-agent`, separate from any other mode |
| **Plugin sharing** | PyPI (trusted publisher) + `hermes plugins enable` |
| **Profile setup** | `hermes jovaltus setup` — interactive, TTY-aware |
| **Profile binding** | Not directory-bound — same profile works across projects |
| **Code review** | Adversarial — tries to break, not just check |
| **QA** | PRD-driven user journeys via the standalone `qa` skill |
| **Skill style** | 5 standalone utilities; progressive disclosure, independently loadable |

---

## License

MIT
