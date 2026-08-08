# Jovaltus — Hermes Plugin (Subagent-Driven Development Framework)

## Build & Test

- `uv run pytest -v` — Run full test suite (131 tests)
- `uv run ruff check .` — Lint
- `uv run ruff format --check .` — Format check
- `uv run mypy` — Type check (strict mode, config in `pyproject.toml`)
- Pre-commit runs lint → mypy → format on commit. Run manually: `pre-commit run --all-files`
- All checks must pass before commit. Zero warnings on lint, type, and format.

## Tech Stack

- **Language**: Python 3.10+
- **Package manager**: uv
- **Framework**: fabricium ≥0.1.1 (Hermes plugin SDK — `HermesPlugin`, `git_utils`, `state`)
- **Testing**: pytest ≥8 with fabricium test harness
- **Lint/Format**: ruff ≥0.8 + mypy ≥1.16 (`--strict` via `pyproject.toml`)
- **Build**: hatchling (src layout)

## Project Structure

- `src/jovaltus/__init__.py` — Plugin entry point: self-bootstraps fabricium, registers CLI + skills via `HermesPlugin` (subclassed as `_JovaltusPlugin` to auto-configure `delegation.max_spawn_depth` on setup/update), then registers 4 tools + 4 hooks
- `src/jovaltus/state.py` — Deterministic pipeline state machine + JSON persistence (`~/.hermes/jovaltus_state.json`, `"pipeline"` key)
- `src/jovaltus/tools.py` — 4 tool handlers (`plan` / `execute` / `simplify` / `review`) + `CHAIN` table + `dispatch_pipeline_step` + completion-routing capture
- `src/jovaltus/hooks.py` — 4 hook callbacks: `subagent_start`, `subagent_stop`, `pre_llm_call`, `post_llm_call`; pushes a completion event to `process_registry.completion_queue` on terminal states so the main agent is notified, and a fix-request event that wakes the main agent to fix review findings
- `src/jovaltus/setup_config.py` — Text-based YAML edit ensuring `delegation.max_spawn_depth >= 2` in profile configs (no yaml dependency)
- `src/jovaltus/prompts/` — 7 subagent goal prompts (prd, research, acceptance, tasks, execute, simplify-review, review)
- `src/jovaltus/plugin.yaml` — Plugin metadata (name, version, description)
- `src/jovaltus/SOUL.md` — Agent identity file applied during `hermes jovaltus setup`
- `src/jovaltus/skills/` — 5 bundled utility skills:
  `agentic-debugging`, `manage-agents-md`, `manage-git-repo`, `project-documentation`, `qa`
- `tests/` — 131 pytest tests across 8 test files + conftest
  - `test_state.py` (25), `test_tools.py` (23), `test_hooks.py` (31), `test_register.py` (5)
  - `test_git_utils.py` (19), `test_sync.py` (8), `test_setup_config.py` (12), `integration/test_cli.py` (8)

## Architecture

v1.0.0 rearchitected Jovaltus into a **subagent-driven deterministic
framework**. The plugin ships 4 tools whose handlers dispatch pipeline
subagents via Hermes's `subagent_lifecycle`; a plugin-owned
state machine (`state.py`, JSON-persisted) drives phase transitions
deterministically; 4 hooks wire subagent lifecycle to the state machine
and inject pipeline status every turn.

- **4 tools**: `plan` (requires `user_requirements`), `execute` /
  `simplify` / `review` (each requires `plan`) — registered via
  `ctx.register_tool` with `toolset="jovaltus"`, `is_async=False`
- **State machine**: `PipelineState` + `PHASES`/`STATUSES`;
  `get_pipeline` / `start_pipeline` / `set_phase` / `register_child` /
  `complete_child` / `set_verdict` / `finish_pipeline` / `status_text` /
  `reset_pipeline`
- **4 hooks**: `subagent_start` associates children via the
  `[jovaltus-pipeline:<tool>:<phase>]` goal marker; `subagent_stop`
  advances the chain (plan: prd→research→acceptance→tasks→done; execute:
  execute→done; simplify/review: verdict-driven loops, no cap) and pushes
  a completion event to `process_registry.completion_queue` on terminal
  states so the main agent is notified, plus a fix-request event that
  wakes the main agent with the reviewer's findings;
  `pre_llm_call` injects `[Jovaltus pipeline] ...` status into every turn;
  `post_llm_call` re-dispatches the reviewer after the main agent's
  `*_waiting` fixing turn ends (the main agent fixes — no fixer subagent)
- **No skill navigation**: the plugin never loads `SKILL.md` files to
  decide pipeline flow — phase behavior lives in `prompts/*.md` goal
  documents dispatched to subagents

## Phase Chains

```
plan:      prd → research → acceptance → tasks → done
execute:   execute → done
simplify:  simplify ⇄ simplify_waiting (verdict-driven loop) → done on "pass"
review:    review ⇄ review_waiting (verdict-driven loop) → done on "pass"
```

## CLI Commands

- `hermes jovaltus setup` — Create `jovaltus-agent` profile, install skills, apply SOUL.md
- `hermes jovaltus status` — Show installation state
- `hermes jovaltus update` — Sync skills, update SOUL.md, pull latest source
- `hermes jovaltus update --check` — Check for updates without applying

## Documentation

- `docs/` — Architecture, conventions, project structure, testing, workflows, setup
- Every doc claim traces to source file + line range. `[INFERRED]` marks unverifiable claims.
- Docs updates keep root `README.md` in sync — it links to `docs/README.md` and reflects current state

## Boundaries

**Always:**
- Run tests before committing
- Add tests for new behaviour
- Match existing code style (ruff + mypy enforce this)

**Ask first:**
- Adding new dependencies
- Modifying bundled skills (`src/jovaltus/skills/*/SKILL.md`)

**Never:**
- Commit `.env` files or secrets
- Edit `generated/` or `__pycache__/` directories
