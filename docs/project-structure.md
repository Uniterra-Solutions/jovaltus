# Project Structure — Jovaltus

| Directory | Responsibility | Key Files |
|-----------|---------------|-----------|
| `src/jovaltus/` | Plugin source — entry point + bundled skills | `__init__.py`, `plugin.yaml`, `SOUL.md` |
| `src/jovaltus/skills/` | 11 bundled Hermes skills (8 pipeline + 3 utility) | 11 `SKILL.md` files + references/assets |
| `tests/` | Pytest suite (39 tests) | `conftest.py`, `test_git_utils.py`, `test_sync.py` |
| `tests/integration/` | CLI integration tests | `test_cli.py`, `conftest.py` |
| `tests/evals/` | Docker-based pipeline evaluation | `test_jovaltus_skills.py`, `tasks.py`, `rubrics.py` |
| `.pre-commit-config.yaml` | Pre-commit hooks: ruff check → mypy → ruff format | — |
| `pyproject.toml` | Project config: deps, build, tooling, entry points | — |
| `src/jovaltus/plugin.yaml` | Plugin metadata (name, version, description) | — |

## Entry Point

```
hermes_agent.plugins → jovaltus = "jovaltus"  (pyproject.toml:17-18)
```

Hermes calls `jovaltus.register(ctx)` at startup. The plugin:

1. Self-bootstraps `fabricium` if missing (`_ensure_fabricium()`)
2. Creates a `HermesPlugin` instance with `default_profile="jovaltus-agent"`
3. Delegates all registration to `plugin.register(ctx)` — Fabricium handles CLI commands + skill discovery

## Source Layout

```
src/jovaltus/
├── __init__.py      # 55 lines — fabricium bootstrap + HermesPlugin delegation
├── plugin.yaml      # Plugin metadata (no provides_tools — skill-driven)
├── SOUL.md          # Agent identity (45 lines)
└── skills/          # 11 skills, each a self-contained directory
    ├── discuss/         # Requirements → PRD (SKILL.md + assets/prd-template.md)
    ├── design/          # Technical design (SKILL.md + assets/design-template.md)
    ├── to-spec/         # PRD → specs (SKILL.md + assets/spec-template.md)
    ├── to-tasks/        # Specs → flat tasks (SKILL.md + assets/manifest + task templates)
    ├── to-environment/  # Worktree setup (SKILL.md + assets/worktree-config.md)
    ├── execute/         # Parallel dispatch (SKILL.md)
    ├── review/          # Adversarial review (SKILL.md + references/review-checklist.md)
    ├── qa/              # PRD-driven QA (SKILL.md + references/app-type-examples.md)
    ├── agentic-debugging/      # Evidence-driven debugging (SKILL.md)
    ├── manage-agents-md/       # AGENTS.md management (SKILL.md + references/)
    └── project-documentation/  # Docs generation (SKILL.md + references/ + templates/)
```

## Test Layout

```
tests/
├── conftest.py              # Shared fixtures (git_repo, clear_task_state)
├── test_git_utils.py        # 18 tests — git operations via fabricium
├── test_sync.py             # 8 tests — state persistence + skill sync
├── integration/
│   ├── conftest.py          # Integration fixtures
│   └── test_cli.py          # 8 tests — setup, status, update CLI commands
└── evals/
    ├── conftest.py          # Eval harness fixtures (Docker + LLM)
    ├── test_jovaltus_skills.py  # 4 tests — end-to-end skill pipeline eval
    ├── tasks.py             # Eval task definitions
    └── rubrics.py           # Eval scoring rubrics
```

## Dependency Graph (by import)

```
__init__.py
  ├── fabricium.HermesPlugin (self-bootstrapped via _ensure_fabricium)
  └── plugin.register(ctx) → CLI commands + skill auto-discovery
```

No internal imports beyond `fabricium`. The plugin is a thin wrapper.

## How to Update

- New skill added? → Add directory to skills/ listing
- Skill renamed/removed? → Update listing
- New test file? → Add to Test Layout
- Import chain changes? → Update Dependency Graph

## Find It Fast

```bash
ls src/jovaltus/skills/                         # All bundled skills
grep -rn '^name:' src/jovaltus/skills/*/SKILL.md  # Skill names + descriptions
ls tests/                                        # Test directory structure
```
