# Conventions — Jovaltus

Rules an agent can check against code. Only conventions that differ from or
extend Python defaults.

## Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Module files | snake_case | `test_git_utils.py`, `test_sync.py` |
| Public functions | snake_case | `register`, `_ensure_fabricium` |
| Private functions | `_` prefix | `_ensure_fabricium` |
| Module-level constants | `UPPER_SNAKE` with `_` prefix if private | `_PLUGIN_DIR` |
| Test files | `test_<module>.py` | `test_git_utils.py` |
| Test functions | `test_<behaviour>` | `test_is_git_repo_true` |
| Skill directories | lowercase, hyphens | `to-tasks`, `agentic-debugging` |
| Skill names (frontmatter) | lowercase, hyphens | `name: to-tasks` |

## Import Ordering

Enforced by ruff. Standard sections: stdlib → third-party → local.

```python
# stdlib
import logging
import subprocess
from pathlib import Path

# third-party
from fabricium import HermesPlugin
```

Self-bootstrap imports (`fabricium`) use `# noqa: E402` when placement after
the bootstrap guard is intentional.

## Error Handling

| Pattern | Usage |
|---------|-------|
| `_ensure_fabricium()` guard | Try/import/except → pip install → retry; plugin never fails to load |
| `subprocess.run(..., check=True)` | Git operations fail fast with clear traceback |
| `logging.getLogger(__name__)` | Standard Python logging, not print |

## Git Commands

All git operations use **list args, never `shell=True`** (enforced by
`fabricium.git_utils`).

```python
# fabricium.git_utils wraps this pattern:
subprocess.run(["git", "commit", "-m", "message"], cwd=repo)
```

## Plugin Pattern

Jovaltus uses the **HermesPlugin delegate pattern** via Fabricium:

```python
plugin = HermesPlugin(
    name="jovaltus",
    plugin_dir=_PLUGIN_DIR,
    default_profile="jovaltus-agent",
)

def register(ctx):
    plugin.register(ctx)  # All registration delegated to Fabricium
```

- Plugin is minimal (~55 lines) — all behavior in skills
- `HermesPlugin` auto-discovers skills from `skills/` directory
- CLI commands registered via Fabricium's built-in command set

## Skill Conventions

| Convention | Detail |
|-----------|--------|
| YAML frontmatter | Required: `name`, `description`, `author`, `version` |
| Verb-form naming | Pipeline skills use verb form: `discuss`, `design`, `execute` |
| Progressive disclosure | Core content first; details in references/assets |
| Skill independence | Every skill loadable standalone; no hard dependency on prior skills |
| Description field | Must include LOAD/Do NOT use triggers for routing |

## Testing

| Convention | Detail |
|-----------|--------|
| `autouse` fixture clears state | `clear_task_state` fixture runs before every test |
| `git_repo` fixture creates temp repo | Isolated git repo per test via `tmp_path` |
| No mocking by default | Tests use real git repos and subprocess calls |
| Integration tests in `tests/integration/` | Separate from unit tests |
| Eval tests in `tests/evals/` | Use `SkillEvalHarness`; require Docker + LLM API keys |

## Commit Messages

Follow conventional commits where applicable. The CHANGELOG follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Security

- Never commit `.env` files
- No hardcoded API keys — eval config from environment variables

## Pre-commit Hook Order

```
1. ruff check (lint)  — blocks commit on failure
2. mypy --strict      — blocks commit on failure
3. ruff format        — auto-formats after checks pass
```

## How to Update

- New naming pattern adopted? → Add to Naming table
- Import style changes? → Update Import Ordering
- New error handling pattern? → Add to Error Handling
- Skill conventions change? → Update Skill Conventions

## Find It Fast

```bash
grep -rn 'def _' src/jovaltus/              # Private functions
grep -rn 'name:' src/jovaltus/skills/*/SKILL.md  # All skill names
grep -rn 'from fabricium' src/              # All fabricium usage
```
