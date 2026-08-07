# Jovaltus — Hermes Plugin (Subagent-Driven Development Framework)

## Build & Test

- `uv run pytest -v` — Run full test suite (102 tests)
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

- `src/jovaltus/__init__.py` — Plugin entry point: self-bootstraps fabricium, registers CLI + skills via `HermesPlugin`, then registers 4 tools + 3 hooks
- `src/jovaltus/state.py` — Deterministic pipeline state machine + JSON persistence (`~/.hermes/jovaltus_state.json`, `"pipeline"` key)
- `src/jovaltus/tools.py` — 4 tool handlers (`plan` / `execute` / `simplify` / `review`) + `CHAIN` table + `dispatch_pipeline_step`
- `src/jovaltus/hooks.py` — 3 hook callbacks: `subagent_start`, `subagent_stop`, `pre_llm_call`
- `src/jovaltus/prompts/` — 9 subagent goal prompts (prd, research, acceptance, tasks, execute, simplify-review, simplify-fix, review, review-fix)
- `src/jovaltus/plugin.yaml` — Plugin metadata (name, version, description)
- `src/jovaltus/SOUL.md` — Agent identity file applied during `hermes jovaltus setup`
- `src/jovaltus/skills/` — 5 bundled utility skills:
  `agentic-debugging`, `manage-agents-md`, `manage-git-repo`, `project-documentation`, `qa`
- `tests/` — 102 pytest tests across 7 test files + conftest
  - `test_state.py` (24), `test_tools.py` (18), `test_hooks.py` (17), `test_register.py` (5)
  - `test_git_utils.py` (19), `test_sync.py` (8), `integration/test_cli.py` (8)

## Architecture

v1.0.0 rearchitected Jovaltus into a **subagent-driven deterministic
framework**. The plugin ships 4 tools whose handlers dispatch pipeline
subagents via Hermes's `subagent_lifecycle`; a plugin-owned
state machine (`state.py`, JSON-persisted) drives phase transitions
deterministically; 3 hooks wire subagent lifecycle to the state machine
and inject pipeline status every turn.

- **4 tools**: `plan` (requires `user_requirements`), `execute` /
  `simplify` / `review` (each requires `plan`) — registered via
  `ctx.register_tool` with `toolset="jovaltus"`, `is_async=False`
- **State machine**: `PipelineState` + `PHASES`/`STATUSES`;
  `get_pipeline` / `start_pipeline` / `set_phase` / `register_child` /
  `complete_child` / `set_verdict` / `finish_pipeline` / `status_text` /
  `reset_pipeline`
- **3 hooks**: `subagent_start` associates children via the
  `[jovaltus-pipeline:<tool>:<phase>]` goal marker; `subagent_stop`
  advances the chain (plan: prd→research→acceptance→tasks→done; execute:
  execute→done; simplify/review: verdict-driven fix loops, no cap);
  `pre_llm_call` injects `[Jovaltus pipeline] ...` status into every turn
- **No skill navigation**: the plugin never loads `SKILL.md` files to
  decide pipeline flow — phase behavior lives in `prompts/*.md` goal
  documents dispatched to subagents

## Phase Chains

```
plan:      prd → research → acceptance → tasks → done
execute:   execute → done
simplify:  simplify ⇄ simplify_fix (verdict-driven loop) → done on "pass"
review:    review ⇄ review_fix (verdict-driven loop) → done on "pass"
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
