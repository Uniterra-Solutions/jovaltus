# Jovaltus v0.7 — Subagent-Driven Architecture Refactor

Date: 07-08-2026
Status: Requirements (authoritative — planning subagent must read this FIRST)

## Goal

Refactor the Jovaltus Hermes plugin from a **skill-driven** pipeline (v0.6:
13 bundled skills guide the main agent through discuss → design → to-spec →
to-tasks → execute → simplify → review → qa) into a **subagent-driven
deterministic framework** (v0.7):

- The plugin ships **4 tools** (`plan`, `execute`, `simplify`, `review`) whose
  handlers dispatch subagents via `ctx.dispatch_tool("delegate_task", ...)`.
- A plugin-owned **state machine** (state.py + JSON persistence for
  cross-session resume) drives phase transitions deterministically — the main
  agent does NOT decide pipeline flow; it only calls tools and reads status.
- **Hooks** (`subagent_start`, `subagent_stop`, `pre_llm_call`) wire subagent
  lifecycle to the state machine and inject pipeline status into the main
  agent's context every turn.
- Bundled skills shrink from 13 to **5 utility skills**: `manage-git-repo`,
  `manage-agents-md`, `project-documentation`, `agentic-debugging`, `qa`
  (qa description must be rewritten — no longer a pipeline phase).

## Design Decisions (confirmed by user, 07-08-2026)

1. **No loop cap** on simplify/review cycles — the review→fixer loop runs
   until the review agent passes. User: "不需要設置上限。現在的LLM基本上
   不可能無限循環".
2. **Cross-session resume** — state persisted to
   `~/.hermes/jovaltus_state.json` (via fabricium `state.load_state` /
   `save_state`), so an interrupted pipeline resumes on next session.
3. **Deterministic framework** — the pipeline must run under the plugin's
   state machine, NOT depend on the main agent's own capability to navigate
   skills. Main agent only: calls tools, reads hook-injected status.
4. Tools communicate pipeline **start and end to the main agent via hooks**
   (`pre_llm_call` context injection) — otherwise the main agent can't see
   status (delegate_task is fire-and-forget from a tool handler).

## Tool Specifications (user's design, verbatim intent)

### `plan`
- **Input**: `user_requirements` (required string).
- **Flow** (each step = dispatch ONE subagent, sequential chain driven by
  the state machine via `subagent_stop` hooks):
  1. Dispatch a subagent that turns requirements into a precisely-defined
     **PRD file**.
  2. On completion, automatically dispatch a **research agent** for tech
     selection + architecture design → writes **design file**.
  3. On completion, dispatch a subagent that writes **acceptance criteria**
     from PRD + design.
  4. On completion, dispatch a **task-splitting subagent** that produces
     `<task_name>.md` — task decomposition into THREE forms: serial, batch
     (serial batches, parallel within batch), fully parallel — expressed as a
     **mermaid graph DAG**.
- **Return**: plan path / status. Main agent passes `user_requirements`.

### `execute`
- **Input**: `plan` path (required).
- **Flow**: dispatch an **orchestrator subagent** that reads the task DAG and
  drives subagents to complete all tasks (level by level; same-level tasks in
  parallel). Plugin auto-attaches its own files as context.
- **Constraint**: execute should NOT commit — leave the git diff for
  simplify/review.

### `simplify`
- **Input**: `plan` path (required).
- **Flow**: dispatch a **review agent** that comprehensively reviews the
  changes (git diff) and points out what can be simplified. Then dispatch a
  **fixer agent** with the review's suggestions. Then review again. Loop until
  the review agent passes. (No iteration cap — decision #1.)

### `review`
- **Input**: `plan` path (required).
- **Flow**: same loop shape as simplify, but the review agent performs
  **adversarial code review** (finds bugs/problems) instead of seeking
  simplification.

## Hermes API Facts (verified against v0.20.0 source, 07-08-2026)

These are CONFIRMED from source — planning must take them as fixed:

1. **`ctx.dispatch_tool("delegate_task", {...})`** — official plugin
   mechanism (`hermes_cli/plugins.py:604`). Returns the tool handler's JSON
   string. From a main-agent tool handler, delegate_task runs with
   `background=_model_background_value(...)` = True (parent depth 0)
   (`tools/delegate_tool.py:3906,3870`) → **fire-and-forget**: returns
   `{"status": "dispatched", "delegation_id": ...}` (async_delegation.py:965),
   subagent result re-enters the main conversation later as a message.
2. **`subagent_start` hook** — fires at spawn (`tools/delegate_tool.py:1598`)
   with kwargs: `parent_session_id`, `parent_turn_id`, `parent_subagent_id`,
   `child_session_id`, `child_subagent_id`, `child_role`, `child_goal`.
3. **`subagent_stop` hook** — fires once per child after completion, for BOTH
   sync and async paths (`_execute_and_aggregate` → `_finalize_child_results`
   → `invoke_hook("subagent_stop", ...)`, delegate_tool.py:2980,3125,2700).
   Kwargs: `parent_session_id`, `parent_turn_id`, `child_session_id`,
   `child_role`, `child_summary`, `child_status`, `tool_call_history`,
   `duration_ms`.
4. **`pre_llm_call` hook** — callbacks may return `{"context": "..."}` (or a
   plain string) which is injected into the current turn's USER message
   (never system prompt — preserves prompt cache). Ephemeral, per-turn
   (`hermes_cli/plugins.py:1919`).
5. **Hooks CAN call `ctx.dispatch_tool`** — documented ("Works from hook
   callbacks regardless of which process the hook fires in") — this is how the
   chain advances: `subagent_stop` hook callback dispatches the next subagent.
6. **Plugin tool/hook registration** — `ctx.register_tool(name, toolset,
   schema, handler, ...)` (`plugins.py:410`) and `ctx.register_hook(hook_name,
   callback)` (`plugins.py:1177`). Fabricium's `HermesPlugin.register(ctx)`
   (fabricium `__init__.py:73`) only registers CLI + bundled skills — tools
   and hooks must be registered ADDITIONALLY in the plugin's `register(ctx)`.
7. **VALID_HOOKS** includes `subagent_start`, `subagent_stop`,
   `pre_llm_call` (`plugins.py:135-165`).
8. Subagents are NOT terminal processes — invisible to
   `process(action='list')`. Results arrive as new messages in the main
   conversation.

## Current Repo Inventory

```
src/jovaltus/
├── __init__.py          # register(): fabricium HermesPlugin + (currently no tools/hooks)
├── plugin.yaml          # name jovaltus, version 0.14.2
├── SOUL.md
└── skills/              # 13 bundled skills (9 pipeline + 4 utility)
    ├── jovaltus/        # core router — DELETE (replaced by tool descriptions)
    ├── discuss/         # DELETE (replaced by plan tool's PRD subagent)
    ├── design/          # DELETE (replaced by plan tool's research subagent)
    ├── to-spec/         # DELETE (replaced by plan tool's acceptance subagent)
    ├── to-tasks/        # DELETE (replaced by plan tool's task-splitter subagent)
    ├── execute/         # DELETE (replaced by execute tool)
    ├── simplify/        # DELETE (replaced by simplify tool)
    ├── review/          # DELETE (replaced by review tool)
    ├── qa/              # KEEP — description rewritten (standalone acceptance testing)
    ├── agentic-debugging/  # KEEP
    ├── manage-agents-md/   # KEEP
    ├── manage-git-repo/    # KEEP
    └── project-documentation/  # KEEP
tests/
├── conftest.py
├── test_git_utils.py    # 18 tests (fabricium git_utils — KEEP)
├── test_sync.py         # 8 tests (fabricium sync — KEEP)
├── integration/
│   ├── conftest.py
│   └── test_cli.py      # 8 tests (Docker CLI tests — KEEP, may need update)
└── evals/
    ├── conftest.py
    ├── tasks.py
    ├── rubrics.py
    └── test_jovaltus_skills.py  # 4 tests — REVIEW: pipeline skills being deleted
docs/
├── README.md  architecture.md  project-structure.md  workflows.md
├── conventions.md  setup.md  testing.md  tech-stack.md
└── modules/plugin-entry.md
```

Test baseline: **39 tests collected** (`uv run pytest --collect-only -q`).

## Constraints

- **AGENTS.md boundaries**: "Ask first" = adding new dependencies, modifying
  bundled skills (`src/jovaltus/skills/*/SKILL.md`). Deleting pipeline skills
  and rewriting qa is EXPLICITLY requested by the user — in scope.
- No new dependencies beyond `fabricium>=0.1.1` (keep pyproject deps as-is).
- **Ruff + mypy strict must pass** (`uv run ruff check .`, `uv run mypy`).
  Zero warnings.
- The 39-test baseline must stay green unless a task explicitly changes it
  (evals may legitimately change if pipeline skills are deleted — the planner
  must decide: rewrite evals to target the 4 tools, or delete them).
- Docs claim every doc statement traces to source file + line range
  (`[INFERRED]` for unverifiable). All docs that reference the skill-driven
  pipeline MUST be updated in Phase 6.
- Release flow: `manage-git-repo` Workflow B — version bump in pyproject.toml
  + plugin.yaml + CHANGELOG.md, tag v0.7.0 (or next semver — planner picks
  breaking-change bump). User runs `hermes jovaltus update` for runtime
  deployment — NO manual runtime sync of skills during development.

## File Contracts (inter-phase artifacts)

Plan artifacts land in a per-run directory, e.g.
`.plan/<DD-MM-YYYY>/<slug>/` (existing Jovaltus convention):
- `prd.md`            — PRD subagent output
- `design.md`         — research agent output (tech stack + architecture)
- `acceptance.md`     — acceptance criteria subagent output
- `<task_name>.md`    — task-splitting subagent output (DAG + mermaid graph)

The state machine tracks: run dir, current phase, active child_session_id,
phase artifacts, pipeline status (for pre_llm_call injection).

## Recommended Module Layout (planner confirms/refines)

```
src/jovaltus/
├── __init__.py        # register(): fabricium + ctx.register_tool x4 + ctx.register_hook x3
├── tools.py           # plan/execute/simplify/review handlers (dispatch subagents)
├── hooks.py           # subagent_start/subagent_stop/pre_llm_call callbacks
├── state.py           # deterministic state machine + JSON persistence (resume)
├── prompts/           # subagent goal prompts (prd, research, acceptance, tasks,
│                      #   execute/orchestrator, simplify-review, simplify-fix,
│                      #   review, review-fix) — read as goal text by handlers
├── plugin.yaml        # version bump
├── SOUL.md
└── skills/            # only the 5 utility skills
```

## Out of Scope

- No changes to fabricium itself.
- No new Hermes core features — everything uses existing v0.20.0 APIs.
- No changes to git_utils tests, sync tests, or Docker CLI test harness unless
  the tool/hook additions break them.

## Phase 7 — Docker E2E Verification (REQUIRED, user mandate 07-08-2026)

After the refactor is implemented and verified locally, the ORCHESTRATOR must
run a real Docker-based agent-behaviour verification:

1. **Copy the local Hermes config into a temp HERMES_HOME**: copy
   `~/.hermes/config.yaml` and `~/.hermes/.env` (provider credentials) into a
   fresh temp dir at `<tmp>/.hermes/` (config.yaml + .env), so the container
   agent has the same model/provider as the local session.
2. **Start a long-running container** (`sleep infinity`) with that HERMES_HOME
   mounted at `/opt/data` and `HERMES_HOME=/opt/data` — iterate-fix-restart
   QA loop per hermes-plugin-testing skill, NOT one-shot `--rm` per command.
3. **Install the plugin inside the container** (pip entry point or copy into
   `/opt/data/plugins/` + `hermes plugins enable jovaltus`; fabricium dep must
   be available — build-time `RUN uv pip install --python /opt/hermes/.venv/bin/python fabricium`
   in a derived image if missing from the base; base image pins uv
   `exclude-newer` so use `ENV UV_EXCLUDE_NEWER=2099-01-01` in the derived
   Dockerfile).
4. **Verify agent behaviour with `docker exec <c> hermes chat -q "<prompt>"`**:
   - `hermes plugins list` shows jovaltus enabled
   - `hermes chat -q` with a prompt that triggers a plugin tool (e.g. "call
     the plan tool with user_requirements=...") — assert exit code 0 and no
     plugin traceback; assert tool-call traces via logs (non-deterministic
     LLM output: assert on side effects + exit code, NOT exact text)
   - Verify at least: plan tool spawns a subagent (subagent_start/stop hooks
     fire), state file written to /opt/data/jovaltus_state.json, pipeline
     status injected via pre_llm_call (visible in a follow-up turn's context
     or agent.log)
5. **Clean up**: `docker rm -f`, `docker rmi <derived-image>`, remove temp
   HERMES_HOME dirs, `docker builder prune -a -f` (keep base image).
   User expects test resources gone when verification passes.

Config note: container agent needs an OpenAI-compatible inference provider —
copying the local config/.env satisfies this; if the local config uses
profile-specific paths, resolve to the default profile's config/.env.
