# Jovaltus — Hermes Plugin (Skill-Driven Development Pipeline)

## Build & Test

- `uv run pytest -v` — Run full test suite (39 tests)
- `uv run ruff check .` — Lint
- `uv run ruff format --check .` — Format check
- `uv run mypy` — Type check (strict mode, config in `pyproject.toml`)
- Pre-commit runs lint → mypy → format on commit. Run manually: `pre-commit run --all-files`
- All checks must pass before commit. Zero warnings on lint, type, and format.

## Tech Stack

- **Language**: Python 3.10+
- **Package manager**: uv
- **Framework**: fabricium ≥0.1.1 (Hermes plugin SDK — `HermesPlugin`, `git_utils`)
- **Testing**: pytest ≥8 with fabricium test harness
- **Lint/Format**: ruff ≥0.8 + mypy ≥1.16 (`--strict` via `pyproject.toml`)
- **Build**: hatchling (src layout)

## Project Structure

- `src/jovaltus/__init__.py` — Plugin entry point: self-bootstraps fabricium, delegates to `HermesPlugin`
- `src/jovaltus/plugin.yaml` — Plugin metadata (name, version, description)
- `src/jovaltus/SOUL.md` — Agent identity file applied during `hermes jovaltus setup`
- `src/jovaltus/skills/` — 11 bundled agent skills (8 pipeline + 3 utility):
  - **Pipeline**: `discuss` → `design` → `to-spec` → `to-tasks` → `to-environment` → `execute` → `review` + `qa`
  - **Utility**: `agentic-debugging`, `manage-agents-md`, `project-documentation`
- `tests/` — 39 pytest tests across 4 test files + conftest
  - `test_git_utils.py` (18), `test_sync.py` (8)
  - `integration/test_cli.py` (8), `evals/test_jovaltus_skills.py` (4)

## Architecture

v0.6.0 rewrote Jovaltus from a stateful pipeline engine into a **skill-driven
Direct Delegate Pattern**. The plugin no longer runs subagents through tool
handlers; it bundles agent skills that guide the orchestrator through each phase.

- **No more tools**: `jovaltus_implement`, `jovaltus_verify`, `jovaltus_simplify` are removed
- **No more state machine**: `state.py`, `hooks.py`, `schemas.py` deleted (~1,700 lines)
- **No more subagent prompts**: `prompts/*.md` deleted — replaced by skill documents
- **Fabricium handles everything**: CLI commands (`setup`, `status`, `update`) and skill bundling

## Pipeline (Skill-Driven)

```
discuss → design → to-spec → to-tasks → to-environment → execute → (review + merge)
```

All tasks run in parallel (flat architecture) — file ownership is proven disjoint.
Cross-task dependencies resolved via inlined interface contracts in TASK.md.

## CLI Commands

- `hermes jovaltus setup` — Create `jovaltus-agent` profile, install skills, apply SOUL.md
- `hermes jovaltus status` — Show installation state
- `hermes jovaltus update` — Sync skills, update SOUL.md, pull latest source
- `hermes jovaltus update --check` — Check for updates without applying

## Documentation

- `docs/` — Architecture, conventions, project structure, testing, workflows, setup
- Every doc claim traces to source file + line range. `[INFERRED]` marks unverifiable claims.

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
