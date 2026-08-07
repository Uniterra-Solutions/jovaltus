# Project Structure — Jovaltus

| Directory | Responsibility | Key Files |
|-----------|---------------|-----------|
| `src/jovaltus/` | Plugin source — entry point, tools, hooks, state machine, prompts | `__init__.py`, `state.py`, `tools.py`, `hooks.py`, `prompts/`, `plugin.yaml`, `SOUL.md` |
| `src/jovaltus/prompts/` | 9 subagent goal prompts (one per pipeline phase) | `prd.md`, `research.md`, `acceptance.md`, `tasks.md`, `execute.md`, `simplify-review.md`, `simplify-fix.md`, `review.md`, `review-fix.md` |
| `src/jovaltus/skills/` | 5 bundled utility Hermes skills | 5 `SKILL.md` files + references/assets/templates |
| `tests/` | Pytest suite (102 tests) | `conftest.py`, `test_state.py`, `test_tools.py`, `test_hooks.py`, `test_register.py`, `test_git_utils.py`, `test_sync.py` |
| `tests/integration/` | CLI integration tests | `test_cli.py`, `conftest.py` |
| `.pre-commit-config.yaml` | Pre-commit hooks: ruff check → mypy → ruff format | — |
| `pyproject.toml` | Project config: deps, build, tooling, entry points | — |
| `src/jovaltus/plugin.yaml` | Plugin metadata (name, version, description) | — |

## Entry Point

```
hermes_agent.plugins → jovaltus = "jovaltus"  (pyproject.toml:17-18)
```

Hermes calls `jovaltus.register(ctx)` at startup. The plugin:

1. Self-bootstraps `fabricium` if missing (`_ensure_fabricium()`,
   `src/jovaltus/__init__.py:18-28`)
2. Creates a `HermesPlugin` instance with `default_profile="jovaltus-agent"`
   (`src/jovaltus/__init__.py:39-43`)
3. Delegates CLI + skill registration to `plugin.register(ctx)`
   (`src/jovaltus/__init__.py:56`)
4. Registers the 4 pipeline tools via `tools.register(ctx)`
   (`src/jovaltus/__init__.py:61`)
5. Registers the 3 hooks via `hooks.init(ctx)` + three `ctx.register_hook`
   calls (`src/jovaltus/__init__.py:62-65`)

## Source Layout

```
src/jovaltus/
├── __init__.py      # register(): fabricium + 4 tools + 3 hooks (67 lines)
├── state.py         # Deterministic state machine + JSON persistence
├── tools.py         # 4 tool handlers + CHAIN table + dispatch_pipeline_step
├── hooks.py         # 3 hook callbacks (subagent_start/stop, pre_llm_call)
├── prompts/         # 9 subagent goal prompts (Markdown, [[token]] placeholders)
│   ├── __init__.py  # PROMPT_NAMES + load_prompt(name)
│   ├── prd.md  research.md  acceptance.md  tasks.md  execute.md
│   └── simplify-review.md  simplify-fix.md  review.md  review-fix.md
├── plugin.yaml      # Plugin metadata (name, version, description)
├── SOUL.md          # Agent identity (45 lines)
└── skills/          # 5 bundled utility skills
    ├── agentic-debugging/      # Evidence-driven debugging (SKILL.md)
    ├── manage-agents-md/       # AGENTS.md management (SKILL.md + references/)
    ├── manage-git-repo/        # Git commit, version, release, branch+PR, stacked PR (SKILL.md)
    ├── project-documentation/  # Docs generation (SKILL.md + references/ + templates/)
    └── qa/                     # Standalone PRD-driven acceptance testing (SKILL.md + references/)
```

## Test Layout

```
tests/
├── conftest.py              # Shared fixtures (git_repo, clear_task_state)
├── test_state.py            # 24 tests — state machine transitions + resume
├── test_tools.py            # 18 tests — 4 tool handlers + dispatch
├── test_hooks.py            # 17 tests — hook callbacks + chain advancement
├── test_register.py         # 5 tests — registration wiring (4 tools + 3 hooks)
├── test_git_utils.py        # 19 tests — git operations via fabricium
├── test_sync.py             # 8 tests — state persistence + skill sync
└── integration/
    ├── conftest.py          # Integration fixtures
    └── test_cli.py          # 8 tests — setup, status, update CLI commands
```

**102 tests total** (24 + 20 + 18 + 5 + 19 + 8 + 8). There is no
`tests/evals/` directory — the eval harness was removed in v1.0.0;
behavioral verification is a Phase 7 Docker E2E gate (see
[testing.md](testing.md)).

## Dependency Graph (by import)

```
__init__.py
  ├── fabricium.HermesPlugin (self-bootstrapped via _ensure_fabricium)
  └── jovaltus.tools (register — tools.py depends on state.py + prompts)
  └── jovaltus.hooks (init — hooks.py depends on state.py + tools.CHAIN)
tools.py
  └── jovaltus.state, jovaltus.prompts
hooks.py
  └── jovaltus.state, jovaltus.tools (CHAIN, dispatch_pipeline_step)
state.py
  └── fabricium.state only (no ctx / Hermes imports — stdlib + fabricium)
```

No module imports `jovaltus/__init__.py` (no circular imports).

## How to Update

- New module added? → Add to Source Layout + Dependency Graph
- New prompt added? → Add file to `prompts/` + `PROMPT_NAMES` + listing
- Skill added/removed? → Update skills/ listing
- New test file? → Add to Test Layout
- Import chain changes? → Update Dependency Graph

## Find It Fast

```bash
ls src/jovaltus/                             # Plugin source modules
ls src/jovaltus/prompts/                     # Subagent goal prompts
ls src/jovaltus/skills/                      # All bundled skills
grep -rn '^name:' src/jovaltus/skills/*/SKILL.md  # Skill names + descriptions
ls tests/                                    # Test directory structure
```
