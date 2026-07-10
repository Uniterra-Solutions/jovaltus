# Jovaltus — Hermes Plugin Agent Mode

## Build & Test

- `uv run pytest -v` — Run full test suite (25 tests, ~1.2s)
- `uv run python3 -m py_compile *.py tests/*.py` — Type/syntax check
- All tests pass before commit. No lint warnings.

## Project Structure

- `plugin.yaml` + `__init__.py` — Hermes plugin entry (root dir IS the package)
- `tools.py` — Three tool handler factories (implement, verify, simplify)
- `schemas.py` — Tool JSON schemas (what the LLM sees)
- `state.py` — Thread-safe in-memory task state
- `git_utils.py` — Git subprocess wrappers (list args, no shell=True)
- `prompts/*.md` — Subagent system prompts (editable without touching Python)
- `skills/jovaltus-agent/SKILL.md` — Agent Mode workflow definition
- `tests/` — 25 pytest tests across 4 test files + conftest.py

## Key Constraints

- All handler functions must accept `(args: dict, **kwargs)` and return JSON string
- All git commands use list args (no `shell=True`)
- State uses `threading.Lock` for thread safety
- Handler factories capture `ctx` in `register()` — closures, not class instances
- Prompt files loaded at factory creation time, not at handler invocation
- Plugin skills are namespaced (`jovaltus:jovaltus-agent`), loaded via `skill_view()`

## Documentation

- `docs/features/` — User-visible behaviour in BDD format (Given/When/Then)
- `docs/architecture/` — Module boundaries and design principles
- `docs/principles/` — Code conventions with source evidence
- Every doc claim traces to source file + line range. `[INFERRED]` marks unverifiable claims.

## Workflow

1. User confirms requirements (Phase 0)
2. Main agent calls `jovaltus_implement` → handler spawns implement subagent
3. Main agent calls `jovaltus_verify(task_id)` → handler spawns verification subagent
4. Main agent calls `jovaltus_simplify(task_id)` → handler spawns simplifier subagent
