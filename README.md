# Jovaltus — Hermes Plugin for Agent Mode

> **Jovaltus** is a Hermes Agent plugin that transforms the main agent into an intelligent development orchestrator. Designed for quick bug fixes and small-to-medium features, it provides a structured four-phase pipeline — Plan → Implement → Verify & Fix → Simplify — while keeping the workflow invisible to the user.

---

## Overview

Jovaltus takes a single user request and runs it through an automated quality pipeline. The user only participates in Phase 0 (requirement clarification). Everything else — implementation, adversarial verification, code simplification — is handled autonomously by subagents.

```
User Request
    │
    ├── Phase 0: Planning (Main Agent)
    │   Round-based clarification → Checklist → User confirmation
    │
    ├── Phase 1: Implement (Subagent)
    │   Writes code. Reports BLOCKED if stuck.
    │
    ├── Phase 2: Verify & Fix (Subagent)
    │   Adversarial testing. Finds problems, fixes them, repeats until clean.
    │
    └── Phase 3: Simplify (Subagent)
        Structural cleanup. No behaviour changes.
```

---

## Architecture

### Three-Layer Design

| Layer | What It Does | Why |
|-------|-------------|-----|
| **Skill** (documents) | Describes what each phase should do. No tool names. | LLM reads this + tool schemas, figures out the flow itself. |
| **Tool Handler** (thin Python) | Records state, reads system prompt from file, spawns subagent via `ctx.dispatch_tool("delegate_task", ...)`. Returns immediately. | One tool call per phase. No manual `delegate_task` from the main agent. Prompt lives in its own file. |
| **Subagent prompt** (markdown) | The system prompt injected into each subagent. Lives in `prompts/*.md`. | Editable without touching Python. Each subagent reads its own prompt. |

### One Tool Call Per Phase

The main agent calls ONE tool per phase. That tool handler:

1. Records state (git hash, task_id)
2. Reads the system prompt from `prompts/<phase>.md`
3. Spawns a subagent via `ctx.dispatch_tool("delegate_task", ...)` with the prompt as goal
4. Returns immediately — the subagent runs in the background

The subagent self-commits when done. Its result arrives as a message
the main agent reads to decide the next phase.

---

## The Four Phases

### Phase 0: Planning (Main Agent)

The only phase the user interacts with.

```
User: "Build a login page"
    │
    ├── Step 1: Round-based clarification (1-3 questions per round, multiple choice)
    │   Scope → Business flow → Constraints → Business value
    │
    ├── Step 2: Decompose into a business requirement checklist
    │
    ├── Step 3: Web search for latest information (avoids knowledge cut-off)
    │
    └── Step 4: User confirms the plan
        "Don't start implementing until the user says yes."
```

### Phase 1: Implement

```
Main agent calls jovaltus_implement
    └─ Handler:
        1. Records start_hash, creates task
        2. Reads prompts/implement.md
        3. ctx.dispatch_tool("delegate_task", {
               goal: implement prompt,
               toolsets: [terminal, file]
           })
        4. Returns {task_id, start_hash}

Subagent works in background:
    • Reads context from handler
    • Writes code (full read/write access)
    • Does NOT verify, does NOT simplify
    • Reports BLOCKED if genuinely stuck
    • git add -A && git commit when done
```

**Tool permissions**: `terminal`, `file` (full read/write).  
**Red lines**: ❌ No touching irrelevant files. ❌ No self-verification. ❌ No self-simplification.

### Phase 2: Verify & Fix

```
Main agent calls jovaltus_verify(task_id)
    └─ Handler:
        1. Looks up task, computes diff (start_hash → HEAD)
        2. Reads prompts/verify.md
        3. ctx.dispatch_tool("delegate_task", {
               goal: verify prompt,
               context: diff output,
               toolsets: [terminal, file]
           })
        4. Returns {task_id, diff_summary}

Subagent works in background (with write access):
    • Runs the code
    • Tries to break it (adversarial mindset)
    • Finds bugs → fixes them directly → re-verifies
    • Loops until all tests pass
    • git add -A && git commit when done
```

**Mindset**: Adversarial. Not "does it work?" but "how can I break this?"  
**Write access**: The subagent can fix what it finds — no read-only reporting. This is the Fable 5 closed-loop model.

### Phase 3: Simplify

```
Main agent calls jovaltus_simplify(task_id)
    └─ Handler:
        1. Looks up task, computes clean diff
        2. Reads prompts/simplify.md
        3. ctx.dispatch_tool("delegate_task", {
               goal: simplify prompt,
               context: clean diff,
               toolsets: [terminal, file]
           })
        4. Returns {task_id, diff_summary}

Subagent works in background:
    • No behaviour changes
    • Structural priorities: extract duplicates > delete dead code > flatten nesting > improve naming
    • Mandatory grep evidence before deleting anything
    • git add -A && git commit when done
```

**Value hierarchy**: Extract duplicates → Delete dead code → Flatten nesting → Improve naming.  
**Safety**: Every deletion requires grep evidence. Behaviour must be strictly preserved.

---

## Installation and Usage

### Step 1: Install the Plugin

```bash
# 從 GitHub 安裝
hermes plugins install LaiTszKin/jovaltus --enable
```

### Step 2: 啟用 Plugin

```bash
hermes plugins enable jovaltus
```

### Step 3: 建立 Profile

```bash
# 一鍵建立 jovaltus-agent profile
hermes jovaltus setup
```

> Profile 建立後，編輯 `~/.hermes/profiles/jovaltus-agent/config.yaml`，
> 確認 model 設定與 root config 一致（若無則複製貼上）：
> ```yaml
> model:
>   default: deepseek-v4-flash
>   provider: deepseek
> ```
> 若不確定 root 設定，執行：`grep -A2 "^model:" ~/.hermes/config.yaml`

### Step 4: 連結 Plugin 到 Profile

```bash
# 將 plugin 原始碼連結到 profile 的 plugins 目錄
ln -s /Users/tszkinlai/uniterra/jovaltus ~/.hermes/profiles/jovaltus-agent/plugins/jovaltus
```

> **為什麼需要這步？** 當使用 `hermes -p <profile>` 啟動 session 時，
> Hermes 只掃描 profile 目錄底下的 plugins，不會掃描全域 `~/.hermes/plugins/`。
> 因此 plugin 必須存在於 profile 的 plugins 子目錄中才會被載入。

### Step 5: 確認安裝

```bash
# 啟動 session 並測試工具是否可用
hermes -p jovaltus-agent

# 在 session 中輸入：
# 「list all tools whose name starts with jovaltus」
#
# 應該看到：
# - jovaltus_implement
# - jovaltus_verify
# - jovaltus_simplify
```

### 日常使用

```bash
# 在任何專案目錄下啟動
cd /projects/app-alpha
hermes -p jovaltus-agent

# Profile 不綁定目錄 — 同一 profile 可在不同 project 使用
cd /projects/app-beta
hermes -p jovaltus-agent
```

### 疑難排解

| 問題 | 解法 |
|------|------|
| `Unknown toolset 'jovaltus'` | Plugin 未正確載入。檢查 Step 4 的 symlink 是否存在 |
| 工具列表沒有 `jovaltus_*` | 確認 profile config 有 `plugins.enabled: [jovaltus]` |
| `No inference provider configured` | Profile config 缺少 model 設定。參考 Step 3 補上 |
| 401 Authentication Error | 確認 profile 的 `.env` 有 API key。複製 root 的：`grep DEEPSEEK ~/.hermes/.env >> ~/.hermes/profiles/jovaltus-agent/.env` |

---

## Project Structure

```
jovaltus/
├── README.md              # Proposal + usage
├── plugin.yaml            # Hermes plugin manifest
├── __init__.py            # register() — creates handler closures, mounts everything
├── schemas.py             # Tool JSON schemas (what the LLM sees)
├── tools.py               # Tool handler factories (capture ctx, spawn subagents)
├── state.py               # In-memory task state
├── git_utils.py           # Git subprocess wrappers
├── skills/
│   └── jovaltus-agent/
│       └── SKILL.md       # Agent Mode workflow (no tool names)
└── prompts/
    ├── implement.md       # Implement subagent system prompt
    ├── verify.md          # Verification subagent system prompt
    └── simplify.md        # Simplifier subagent system prompt
```

---

## Technical Decisions

| Aspect | Decision |
|--------|----------|
| **Profile** | `jovaltus-agent`, separate from any other mode |
| **Plugin sharing** | GitHub repo + `hermes plugins install` |
| **Profile init** | Plugin provides `hermes jovaltus setup` CLI command (`ctx.register_cli_command`) |
| **Profile binding** | Not directory-bound — same profile works across projects |
| **Pipeline control** | Skill document guides main agent. Each phase = one tool call. |
| **Git tracking** | Tool handler records start_hash. Subagent self-commits when done. |
| **Subagent spawning** | Tool handler calls `ctx.dispatch_tool("delegate_task", ...)` with prompt from file |
| **System prompts** | Stored in `prompts/*.md`, read by handler at call time |
| **Verify loop** | Verification subagent has write access and runs a self-contained loop |
| **Simplify input** | Handler computes clean diff (start vs HEAD, no intermediate commits) |
| **Skill style** | Describes *what* to do, never names tools other than the three plugin tools |
| **Plugin skills** | Read-only, namespaced (`"jovaltus:jovaltus-agent"`), loaded via `skill_view()` |

---

## License

MIT
