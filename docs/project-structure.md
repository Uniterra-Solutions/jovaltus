# Project Structure — Jovaltus

| Directory | Responsibility | Key Files |
|-----------|---------------|-----------|
| `src/jovaltus/` | Plugin source — entry point, tools, hooks, state machine, setup auto-config, prompts | `__init__.py`, `state.py`, `tools.py`, `hooks.py`, `setup_config.py`, `prompts/`, `plugin.yaml`, `SOUL.md` |
| `src/jovaltus/prompts/` | 7 subagent goal prompts (one per dispatched pipeline phase) | `prd.md`, `research.md`, `acceptance.md`, `tasks.md`, `execute.md`, `simplify-review.md`, `review.md` |
| `src/jovaltus/skills/` | 5 bundled utility Hermes skills | 5 `SKILL.md` files + references/assets/templates |
| `tests/` | Pytest suite (131 tests) | `conftest.py`, `test_state.py`, `test_tools.py`, `test_hooks.py`, `test_register.py`, `test_git_utils.py`, `test_sync.py`, `test_setup_config.py` |
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
2. Creates a `_JovaltusPlugin` instance (subclass of `HermesPlugin` with
   setup/update auto-configuration) with `default_profile="jovaltus-agent"`
   (`src/jovaltus/__init__.py:36-84`)
3. Delegates CLI + skill registration to `plugin.register(ctx)`
   (`src/jovaltus/__init__.py:96`)
4. Registers the 4 pipeline tools via `tools.register(ctx)`
   (`src/jovaltus/__init__.py:101`)
5. Registers the 4 hooks via `hooks.init(ctx)` + four `ctx.register_hook`
   calls (`src/jovaltus/__init__.py:102-106`)

## Source Layout

```
src/jovaltus/
├── __init__.py      # register(): fabricium + 4 tools + 4 hooks + setup/update auto-config (107 lines)
├── state.py         # Deterministic state machine + JSON persistence
├── tools.py         # 4 tool handlers + CHAIN table + dispatch_pipeline_step + routing capture
├── hooks.py         # 4 hook callbacks (subagent_start/stop, pre/post_llm_call) + completion notification
├── setup_config.py  # Text-based YAML edit: ensure delegation.max_spawn_depth >= 2 in profile config
├── prompts/         # 7 subagent goal prompts (Markdown, [[token]] placeholders)
│   ├── __init__.py  # PROMPT_NAMES + load_prompt(name)
│   ├── prd.md  research.md  acceptance.md  tasks.md  execute.md
│   └── simplify-review.md  review.md
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
├── test_state.py            # 25 tests — state machine transitions + resume + prompts
├── test_tools.py            # 23 tests — 4 tool handlers + dispatch + routing capture
├── test_hooks.py            # 31 tests — hook callbacks + chain advancement + completion notification
├── test_register.py         # 5 tests — registration wiring (4 tools + 4 hooks)
├── test_git_utils.py        # 19 tests — git operations via fabricium
├── test_sync.py             # 8 tests — state persistence + skill sync
├── test_setup_config.py     # 12 tests — YAML editor + HermesPlugin auto-config wiring
└── integration/
    ├── conftest.py          # Integration fixtures
    └── test_cli.py          # 8 tests — setup, status, update CLI commands
```

**131 tests total** (pytest collects parametrized cases; per-file counts
are in the Test Layout table above). There is no
`tests/evals/` directory — the eval harness was removed in v1.0.0;
behavioral verification is a Phase 7 Docker E2E gate (see
[testing.md](testing.md)).

## Dependency Graph (by import)

```
__init__.py
  ├── fabricium.HermesPlugin (self-bootstrapped via _ensure_fabricium)
  ├── jovaltus.setup_config (relative import — ensures max_spawn_depth on setup/update)
  └── jovaltus.tools (register — tools.py depends on state.py + prompts)
  └── jovaltus.hooks (init — hooks.py depends on state.py + tools.CHAIN)
tools.py
  └── jovaltus.state, jovaltus.prompts
hooks.py
  └── jovaltus.state, jovaltus.tools (CHAIN, dispatch_pipeline_step, _ROUTING)
setup_config.py
  └── (stdlib pathlib only)
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
