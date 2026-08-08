# Architecture — Jovaltus

Jovaltus is a Hermes plugin that implements a **subagent-driven deterministic
development framework**. The plugin ships 4 tools (`plan`, `execute`,
`simplify`, `review`) whose handlers dispatch isolated subagents via
Hermes's `subagent_lifecycle`; a plugin-owned state machine
(`state.py`, JSON-persisted for cross-session resume) records every phase
transition; and 4 hooks (`subagent_start`, `subagent_stop`, `pre_llm_call`,
`post_llm_call`)
drive the chain forward deterministically and inject pipeline status into
the main agent's context every turn. The main agent does NOT decide pipeline
flow — it calls tools and reads status.

The plugin also bundles **5 utility skills** (`agentic-debugging`,
`manage-agents-md`, `manage-git-repo`, `project-documentation`, `qa`) that
pipeline subagents load for specific jobs. The 4 tools, state machine, and
hooks are implemented in Python; the skills are independent Hermes skills.

## System Context (C4 Level 1)

```mermaid
graph TD
    Agent[Main Agent] -->|calls tool| Tools[4 Plugin Tools<br/>plan / execute / simplify / review]
    Tools -->|subagent_lifecycle.launch| Sub[Pipeline Subagents]
    Hooks[Hooks<br/>subagent_start / subagent_stop / pre_llm_call] -->|advance chain| State[State Machine<br/>state.py + jovaltus_state.json]
    State -->|status line| Agent
    Sub -->|write artifacts| RunDir[.plan/&lt;YYYYmmdd&gt;/&lt;plan_name&gt;/]
    Sub -->|read/write| Repo[Git Repository]
```

**Users:** A main agent (human + LLM) that calls the 4 tools and reads the
hook-injected status line.

**External services:**

| Service | Purpose | Protocol |
|---------|---------|----------|
| Hermes Agent Runtime | Host process; calls `register(ctx)` at startup | Python in-process |
| LLM Provider | Powers main agent + pipeline subagents | HTTP API |
| Git Repository | Source of truth; `execute` leaves the diff uncommitted for simplify/review | git CLI |
| `~/.hermes/jovaltus_state.json` | Persisted pipeline state (cross-session resume) | JSON via `fabricium.state` |

## Container View (C4 Level 2)

```mermaid
graph TD
    Agent -->|plan / execute / simplify / review| Tools[Tool Handlers<br/>tools.py]
    Tools -->|start_pipeline + dispatch| State[state.py]
    Tools -->|delegate_task| Sub[Pipeline Subagent]
    Hooks[Hooks<br/>hooks.py] -->|complete_child + dispatch next| State
    Hooks -->|delegate_task| Sub
    Prompts[prompts/*.md] -->|goal text| Tools
    Prompts -->|goal text| Hooks
    Fabricium[Fabricium SDK] -->|HermesPlugin| CLI[CLI Commands]
```

| Container | Technology | Purpose |
|-----------|-----------|---------|
| Tool Handlers (`tools.py`) | Python | Validate args, start pipeline, dispatch first-phase subagent; `execute` also checks `delegation.max_spawn_depth` |
| State Machine (`state.py`) | Python + JSON | `PipelineState` dataclass; phase/status/child/verdict bookkeeping; persisted under the `"pipeline"` key |
| Hooks (`hooks.py`) | Python | `subagent_start` associates children, `subagent_stop` advances the chain, `pre_llm_call` injects status |
| Subagent Prompts (`prompts/`) | Markdown | 9 goal documents, one per phase, with `[[token]]` placeholders |
| Bundled Skills (`skills/`) | Markdown (SKILL.md) | 5 utility skills loaded by subagents |
| CLI Commands | `hermes jovaltus setup\|status\|update` | Profile management + skill installation (fabricium) |

## Plugin Architecture

The registration flow (Contract §6) is in `src/jovaltus/__init__.py`
(`register()`, lines 46-67):

```python
def register(ctx):
    plugin.register(ctx)                  # fabricium: CLI + bundled skills (line 56)
    jovaltus_tools.register(ctx)          # 4 tools (line 61)
    jovaltus_hooks.init(ctx)              # capture ctx for hooks (line 62)
    ctx.register_hook("subagent_start", hooks.on_subagent_start)   # line 63
    ctx.register_hook("subagent_stop", hooks.on_subagent_stop)     # line 64
    ctx.register_hook("pre_llm_call", hooks.on_pre_llm_call)       # line 65
```

**What Fabricium handles** (`plugin.register(ctx)`): CLI command registration
(`setup`, `status`, `update`, `update --check`) and bundled skill
auto-discovery from `src/jovaltus/skills/`.

**What the plugin adds** on top of fabricium:
- **4 tools** (`tools.register`, `src/jovaltus/tools.py:85-140`): `plan`
  (requires `user_requirements`), `execute` / `simplify` / `review`
  (each requires `plan`). All registered with `toolset="jovaltus"`,
  `is_async=False`; handlers are `handler(args, **kwargs) -> str` returning
  JSON (`{"status":"started"|"error", ...}`).
- **State machine** (`src/jovaltus/state.py`): `PipelineState` dataclass
  (lines 53-94), `PHASES` (24-34), `STATUSES` (36), and the API in
  `get_pipeline` / `start_pipeline` / `set_phase` / `register_child` /
  `complete_child` / `set_verdict` / `finish_pipeline` / `status_text` /
  `reset_pipeline`.
- **4 hooks** (`src/jovaltus/hooks.py`): `on_subagent_start` (44-64),
  `on_subagent_stop` (67-90), `on_pre_llm_call` (93-106),
  `on_post_llm_call` (109-143).

## State Machine and Phase Chains

Pipeline state lives in `~/.hermes/jovaltus_state.json` under the top-level
`"pipeline"` key (the `"profiles"` key is fabricium-owned and never touched)
— `src/jovaltus/state.py:107-116`. Every transition is persisted, so an
interrupted pipeline resumes on the next session via `get_pipeline()`
(`state.py:119-128`).

Phase sequences (chain table `CHAIN` in `src/jovaltus/tools.py:57-67`):

| Tool | Chain | Terminal |
|------|-------|----------|
| `plan` | prd → research → acceptance → tasks | done (produces `tasks.md` DAG manifest) |
| `execute` | execute | done |
| `simplify` | simplify ⇄ simplify_waiting (verdict-driven loop) | done on `"pass"` verdict |
| `review` | review ⇄ review_waiting (verdict-driven loop) | done on `"pass"` verdict |

`PHASES` (`state.py:24-34`): `prd`, `research`, `acceptance`, `tasks`,
`execute`, `simplify`, `simplify_waiting`, `review`, `review_waiting`.

### How a chain advances

1. A tool handler validates its args, calls `start_pipeline(tool, run_dir,
   ...)` (`state.py:131-158`), and dispatches the first phase via
   `dispatch_pipeline_step` (`tools.py:196-240`) — which loads the phase's
   prompt, substitutes `[[token]]` placeholders with `str.replace`
   (`tools.py:172-182`), and calls
   `subagent_lifecycle.launch(SubagentLaunchRequest(goal=..., context=...,
   "role": "orchestrator" | "leaf"})`. The `role` is `"orchestrator"` only
   for the execute phase.
2. `subagent_start` fires when the child spawns: `on_subagent_start`
   (`hooks.py:42-63`) matches the child's goal against the
   `[jovaltus-pipeline:<tool>:<phase>]` marker and records the child as the
   pipeline's active child via `register_child` (`state.py:170-174`). No
   marker match → no-op (orchestrator grandchildren, foreign children, and
   user-initiated subagents never touch pipeline state).
3. `subagent_stop` fires when the child completes: `on_subagent_stop`
   (`hooks.py:67-90`) calls `complete_child` (`state.py:177-194`) — True
   only for the active child. A non-`"success"` status fails the pipeline
   (`finish_pipeline(ok=False, error=summary)`); otherwise `_advance`
   (`hooks.py:146-188`) follows the chain:
   - simplify/review reviewer phases: reads `<run_dir>/verdict.json`
     (`hooks.py:269-284`); `"pass"` → `set_verdict` + `finish_pipeline(ok=True)`;
     `"fix"` → increment `loop_iteration`, set verdict, park the pipeline in
     the `*_waiting` phase (`_waiting_phase`, `hooks.py:192-201`) and push a
     fix-request event (`_push_fix_request_event`, `hooks.py:287-305`) that
     wakes the main agent with the findings. **No fixer subagent is
     dispatched** — the main agent performs the fixes (it has no subagent
     iteration cap and full conversation context). **No iteration cap.**
   - Other phases: `set_phase(next)` (`state.py:161-167`) + dispatch the
     next phase's subagent. `next_phase == "done"` → finish with `ok=True`.
4. `pre_llm_call` fires before every main-agent turn: `on_pre_llm_call`
   (`hooks.py:93-106`) returns `{"context": status_text(p)}` when a pipeline
   exists, else `None` — the status line
   (`[Jovaltus pipeline] tool=... phase=... status=... run_dir=...`,
   `state.py:217-229`) is injected into the user message so the main agent
   always sees pipeline state.
5. `post_llm_call` fires after every completed agent turn:
   `on_post_llm_call` (`hooks.py:109-143`) re-dispatches the reviewer when
   the pipeline is parked in a `*_waiting` phase and the completed turn
   belongs to the main agent (`platform != "subagent"`). This is how the
   loop re-runs the review after the main agent finishes fixing — and it is
   inert once the pipeline is `done`/`failed`, so the hook effectively does
   not exist outside the loop.

## Tool Details

All four handlers live in `src/jovaltus/tools.py` and return a JSON string
(Contract §1): `{"status":"started","tool":...,"phase":...,"run_dir":...,
"message":...}` on success, `{"status":"error","message":...}` on invalid
input (e.g. missing `plan` path, nonexistent plan file).

| Tool | Handler | Input | Behavior |
|------|---------|-------|----------|
| `plan` | `plan_handler` (`tools.py:379-393`) | `user_requirements` (required) | Computes run dir `<repo_root>/.plan/<YYYYmmdd>/<plan_name>/` (`tools.py:488-503`; repo root inherited from the main agent via `resolve_agent_cwd()` — per-session cwd → `TERMINAL_CWD` → process cwd, `tools.py:337-376`; plan_name = kebab-case of first ~6 words, `-2`/`-3`… suffix on collision); creates the run dir; starts pipeline phase `prd` |
| `execute` | `execute_handler` (`tools.py:395-407`) | `plan` (required, must exist) | Precondition: effective `delegation.max_spawn_depth >= 2` (`tools.py:519-569`), else returns error; starts pipeline phase `execute` with `role="orchestrator"` |
| `simplify` | `simplify_handler` (`tools.py:409-421`) | `plan` (required, must exist) | Starts pipeline phase `simplify` (reviewer) |
| `review` | `review_handler` (`tools.py:423-434`) | `plan` (required, must exist) | Starts pipeline phase `review` (reviewer) |

The repo root is passed to children twice: as a `[[repo_root]]` token in
every prompt (`tools.py:313-325`, substituted with the main agent's working
dir from `_repo_root()`), and inside the `context` text
(`tools.py:327-335`) — never as a tool parameter (the `delegate_task`
handler ignores `workspace_path`/`max_spawn_depth`).

When a pipeline reaches a terminal state (done or failed), `subagent_stop`
pushes a completion event onto the shared `process_registry.completion_queue`
(`hooks.py:180-216`) — the same rail background terminal tasks use — so the
desktop/TUI, CLI, and gateway surfaces wake the main agent with a
"pipeline complete" turn instead of leaving it silent until the user's next
message. Routing metadata (session key, UI session id) is captured on the
first main-turn dispatch (`tools.py:79-99`).

Every subagent reads the repository first. Each prompt's Step 0 instructs
the child to explore `[[repo_root]]` — `AGENTS.md`/`CLAUDE.md`, the project
manifest, source layout, and tests — before producing its artifact, so
PRD/design/acceptance/tasks are grounded in real code and reviewers judge
diffs in context. Greenfield repos (no relevant code) are handled
explicitly in each prompt.

**Subagents share the main agent's toolset.** `SubagentLaunchRequest`
leaves `allowed_toolsets` unset (`tools.py:244-252`), so Hermes child
construction inherits the parent's enabled toolsets
(`delegate_tool.py:1392-1395`) instead of restricting children to a fixed
list — the same file/terminal/web tools that let the main agent read the
repo are available to every pipeline subagent.

## Subagent Prompts (`prompts/`)

`src/jovaltus/prompts/` is a Python package (`PROMPT_NAMES`,
`__init__.py:11-19`; `load_prompt`, `__init__.py:24-39` — raises
`FileNotFoundError` for unknown names). Each of the 7 Markdown files is the
goal document for one phase's subagent:

| File | Phase | Artifact written to `run_dir` |
|------|-------|-------------------------------|
| `prd.md` | prd | `prd.md` |
| `research.md` | research | `design.md` |
| `acceptance.md` | acceptance | `acceptance.md` |
| `tasks.md` | tasks | `tasks.md` (task DAG manifest: serial / batch / fully-parallel forms + mermaid DAG) |
| `execute.md` | execute | none — orchestrator drives the DAG level by level, **no git commits** (diff left for simplify/review) |
| `simplify-review.md` | simplify | `verdict.json` `{"verdict":"pass"\|"fix","findings":"…"}` |
| `review.md` | review | `verdict.json` (adversarial review findings) |

There are no fixer prompts: a `"fix"` verdict parks the pipeline in the
`*_waiting` phase and the MAIN agent fixes the findings directly (no
subagent iteration cap); `on_post_llm_call` then re-dispatches the reviewer.

Token substitution is `str.replace` on `[[token]]` (`tools.py:253-263`) —
never `.format()`, because prompt bodies contain mermaid `{}` braces. Tokens
are `[[run_dir]]`, `[[repo_root]]`, `[[user_requirements]]` (prd only), and
`[[plan_path]]` (execute/simplify/review phases). Every
prompt also carries the literal marker `[jovaltus-pipeline:TOOL:PHASE]`
which the dispatcher replaces with the real
`[jovaltus-pipeline:<tool>:<phase>]` marker used by `subagent_start`
(`tools.py:36-38`).

## Bundled Skills (5 utility)

Fabricium auto-discovers skills from `src/jovaltus/skills/` (one directory
per skill, each with `SKILL.md`). The 5 bundled skills are independent
Hermes skills — they are NOT pipeline phases and the state machine never
navigates them:

| Skill | Purpose |
|-------|---------|
| `agentic-debugging` | Evidence-driven debugging for bugs, errors, crashes, test failures |
| `manage-agents-md` | Create, audit, update agent specification files (AGENTS.md, CLAUDE.md, ...) |
| `manage-git-repo` | Git repository management: commits, semantic-version releases, branches + PRs |
| `project-documentation` | Generate a structured multi-file docs/ tree from any codebase |
| `qa` | Standalone PRD-driven acceptance testing across all app types |

## Key Architectural Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Subagent-driven, deterministic framework | Main agent calls tools and reads status; the state machine + hooks decide flow | Active |
| State machine with JSON persistence | Cross-session resume; deterministic transitions; plugin-owned (`"pipeline"` key, `"profiles"` untouched) | Active |
| 4 hooks wire subagent lifecycle | `subagent_start` associates, `subagent_stop` advances, `pre_llm_call` injects status, `post_llm_call` re-dispatches the reviewer after the main agent's fixing turn | Active |
| Main agent fixes, not a fixer subagent | A fixer leaf subagent shares the 50-iteration delegation cap and gets cut off mid-fix on large findings (observed 2026-08-08: 16 iteration-capped rounds); the main agent has no such cap | Active |
| No iteration cap on simplify/review loops | The verdict file is the loop's exit condition; the main agent fixes until the reviewer passes | Active |
| `execute` leaves the diff uncommitted | simplify/review operate on the working tree diff, not commits | Active |
| Fabricium as the only runtime dependency | Avoids duplicating git wrappers, CLI registration, skill bundling, and state persistence | Active |
| Self-bootstrap fabricium on import | Hermes may recreate its venv, dropping plugin deps; repair on first import | Active |

## Deployment

Jovaltus is distributed as a pip-installable Hermes plugin via PyPI
(trusted publisher).

```
CI/CD → git tag → PyPI trusted publisher → pip install jovaltus
```

`hermes jovaltus setup` creates the `jovaltus-agent` profile, installs the
bundled skills, and optionally applies `SOUL.md`.

## How to Update

- New tool added? → Update Tool Details table + registration flow
- Phase chain changes? → Update the chain table (source of truth:
  `CHAIN` in `src/jovaltus/tools.py`)
- New prompt added? → Update the prompts table + `PROMPT_NAMES`
- Hook behavior changes? → Update the "How a chain advances" section
- Skill added/removed? → Update Bundled Skills table
- Plugin API changes? → Update Plugin Architecture section
- Fabricium API changes? → Update Container View

## Find It Fast

```bash
cat src/jovaltus/__init__.py          # register() flow (Contract §6)
cat src/jovaltus/state.py             # State machine (PHASES, STATUSES, API)
cat src/jovaltus/tools.py             # 4 tool handlers + CHAIN + dispatch
cat src/jovaltus/hooks.py             # 4 hook callbacks
ls src/jovaltus/prompts/              # 7 subagent goal prompts
ls src/jovaltus/skills/               # 5 bundled utility skills
```
