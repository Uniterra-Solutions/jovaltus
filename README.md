# Jovaltus — Hermes Plugin for Skill-Driven Development

> **Jovaltus** bundles 11 agent skills that guide an orchestrator through a
> complete development pipeline — from requirements discovery to parallel
> execution, adversarial review, and PRD-driven QA. The plugin itself is
> minimal; the skills do the work.

---

## Overview

v0.6.0 rewrote Jovaltus from a stateful pipeline engine into a **skill-driven
Direct Delegate Pattern**. The plugin no longer exposes tools
(`jovaltus_implement`, `jovaltus_verify`, `jovaltus_simplify`); instead, it
bundles self-contained skills that the orchestrator loads at each phase.

```
discuss → design → to-spec → to-tasks → to-environment → execute → (review → merge → qa)
```

Every skill is independently loadable via `skill_view()`. The orchestrator
(you, or another agent) controls the flow — skills describe what to do at
each phase, and the orchestrator decides when to move forward.

---

## The Pipeline

### Phase 1: `discuss` — Requirements Discovery

Interactive elicitation. Agent asks adaptive questions across 8 domains
(scope, business flow, constraints, value, etc.), produces a minimal PRD
under `.plan/<date>/<name>/prd.md`.

### Phase 2: `design` — Dialectical Technical Design

Every design decision challenged: "Why this? Why not simpler?" Produces
`design.md` covering all 10 design domains or marked N/A.

### Phase 3: `to-spec` — Implementation Specs

Translates PRD + design into agent-executable specs. Each spec is
self-contained: concrete stack, exact file paths, Given/When/Then
acceptance criteria. Agents can implement without follow-up questions.

### Phase 4: `to-tasks` — Task Decomposition

Decomposes specs into flat, independent task files. Every task owns
disjoint files — zero shared write targets. Cross-task dependencies
resolved via inlined interface contracts. Produces manifest + per-task
files under `.plan/<date>/<name>/tasks/`.

### Phase 5: `to-environment` — Worktree Isolation

Creates isolated git worktrees per task with sparse-checkout scoped to
only the files that task needs. Blast-radius analysis for brownfield
projects. Produces worktrees under `.worktrees/`.

### Phase 6: `execute` — Parallel Dispatch

Spawns subagents into all worktrees simultaneously via
`terminal(background=true)`. All tasks run concurrently because file
ownership is proven disjoint. Updates manifest execution status.

### Phase 7: `review` — Adversarial Code Review

Spawns a review subagent into each worktree that tries to BREAK the code.
Exhaustive enumeration: walks every branching path, violates assumptions,
constructs failure cascades. Depth calibrates by risk signal. Merges
branches and cleans up worktrees after passing.

### Phase 8: `qa` — PRD-Driven Acceptance Testing

Exercises every PRD requirement as a real user journey. Browser for web,
terminal for CLI/API, computer-use for desktop. Fixes issues immediately
with regression tests; loops until all requirements pass.

---

## Bundled Skills (11 total)

| Skill | Type | Purpose |
|-------|------|---------|
| `discuss` | Pipeline | Interactive requirements → PRD |
| `design` | Pipeline | Dialectical technical design |
| `to-spec` | Pipeline | PRD + design → implementation specs |
| `to-tasks` | Pipeline | Flat, independent task decomposition |
| `to-environment` | Pipeline | Isolated git worktrees per task |
| `execute` | Pipeline | Parallel subagent dispatch |
| `review` | Pipeline | Adversarial 4-layer code review |
| `qa` | Pipeline | PRD-driven acceptance testing |
| `agentic-debugging` | Utility | 5-phase evidence-driven debugging |
| `manage-agents-md` | Utility | AGENTS.md creation, audit, maintenance |
| `project-documentation` | Utility | Multi-file docs/ tree generation |

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
# 「list all skills whose name matches jovaltus」
# 應該看到 pipeline + utility skills 共 11 個
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

### 使用 Pipeline

```bash
# 1. 啟動 session
hermes -p jovaltus-agent

# 2. 載入第一個 skill，開始需求發現
#    「load skill discuss」

# 3. 按順序載入：discuss → design → to-spec → to-tasks
#    → to-environment → execute → review → qa

# 每個 skill 會指導你完成該階段，產出對應的 artifacts
```

### 疑難排解

| 問題 | 解法 |
|------|------|
| Skills 未出現 | Plugin 未正確載入。檢查 Step 5 的 symlink 是否存在 |
| `No inference provider configured` | Profile config 缺少 model 設定。參考 Step 4 補上 |
| 401 Authentication Error | 確認 profile 的 `.env` 有 API key |
| `Unknown command: jovaltus` | Plugin 未啟用。執行 `hermes plugins enable jovaltus` |

---

## Architecture

### Skill-Driven Direct Delegate Pattern

Jovaltus v0.6.0 is not a pipeline engine — it's a skill bundle. The plugin:

1. **Self-bootstraps** fabricium on import (survives Hermes venv recreation)
2. **Registers CLI commands** via `fabricium.HermesPlugin` (`setup`, `status`, `update`)
3. **Bundles 11 skills** auto-discovered by Fabricium from `src/jovaltus/skills/`

That's it. No tools, no state machine, no hooks, no subagent spawning logic.
The orchestrator loads skills and follows their guidance.

### Why This Architecture?

| Old (v0.5.x) | New (v0.6.0) |
|---------------|---------------|
| 3 tools + state machine + hooks + schemas | 11 self-contained skills |
| ~2,200 lines of Python | ~55 lines of Python |
| Pipeline hardcoded in tool handlers | Pipeline defined by skill documents |
| Edit prompts → edit Python | Edit skills → edit Markdown |
| Subagents spawned by plugin code | Subagents spawned by orchestrator following skill guidance |

---

## Project Structure

```
jovaltus/
├── README.md
├── AGENTS.md
├── CHANGELOG.md
├── pyproject.toml
├── src/jovaltus/
│   ├── __init__.py          # Entry point (55 lines) — fabricium self-bootstrap + HermesPlugin
│   ├── plugin.yaml          # Plugin metadata
│   ├── SOUL.md              # Agent identity
│   └── skills/              # 11 bundled skills (8 pipeline + 3 utility)
│       ├── discuss/         # Requirements discovery → PRD
│       ├── design/          # Dialectical technical design
│       ├── to-spec/         # PRD → implementation specs
│       ├── to-tasks/        # Flat task decomposition
│       ├── to-environment/  # Git worktree isolation
│       ├── execute/         # Parallel subagent dispatch
│       ├── review/          # Adversarial code review
│       ├── qa/              # PRD-driven acceptance testing
│       ├── agentic-debugging/
│       ├── manage-agents-md/
│       └── project-documentation/
├── tests/
│   ├── test_git_utils.py    # 18 tests
│   ├── test_sync.py         # 8 tests
│   ├── integration/
│   │   └── test_cli.py      # 8 tests
│   └── evals/
│       └── test_jovaltus_skills.py  # 4 eval tests
└── docs/                    # Project documentation
```

---

## Technical Decisions

| Aspect | Decision |
|--------|----------|
| **Architecture** | Skill-driven Direct Delegate — plugin is minimal, skills do the work |
| **Profile** | `jovaltus-agent`, separate from any other mode |
| **Plugin sharing** | PyPI (trusted publisher) + `hermes plugins enable` |
| **Profile setup** | `hermes jovaltus setup` — interactive, TTY-aware |
| **Profile binding** | Not directory-bound — same profile works across projects |
| **Pipeline control** | Orchestrator loads skills in sequence; skills describe what to do |
| **Parallel execution** | Flat — all tasks simultaneous, file ownership proven disjoint |
| **Code review** | Adversarial — tries to break, not just check |
| **QA** | PRD-driven user journeys, not unit tests |
| **Skill style** | Progressive disclosure, verb-form naming, independently loadable |

---

## License

MIT
