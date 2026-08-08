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
| Test files | `test_<module>.py` | `test_state.py`, `test_tools.py` |
| Test functions | `test_<behaviour>` | `test_is_git_repo_true` |
| Skill directories | lowercase, hyphens | `agentic-debugging`, `manage-git-repo` |
| Skill names (frontmatter) | lowercase, hyphens | `name: agentic-debugging` |

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

Jovaltus uses a **subagent-driven plugin pattern** via Fabricium +
`ctx.register_tool` / `ctx.register_hook`:

```python
plugin = HermesPlugin(
    name="jovaltus",
    plugin_dir=_PLUGIN_DIR,
    default_profile="jovaltus-agent",
)

def register(ctx):
    plugin.register(ctx)          # fabricium: CLI + bundled skills
    jovaltus_tools.register(ctx)  # 4 tools: plan / execute / simplify / review
    jovaltus_hooks.init(ctx)      # capture ctx for hooks
    ctx.register_hook("subagent_start", hooks.on_subagent_start)
    ctx.register_hook("subagent_stop", hooks.on_subagent_stop)
    ctx.register_hook("pre_llm_call", hooks.on_pre_llm_call)
```

### Tools

- Registered via `ctx.register_tool(name, toolset, schema, handler, ...)`
  with `toolset="jovaltus"` and `is_async=False`
  (`src/jovaltus/tools.py:85-140`)
- Handler signature: `handler(args, **kwargs) -> str` — `args` is the
  tool-call arguments dict; the return value is a JSON string
  (`{"status":"started"|"error", ...}`)
- Schemas are minimal: `plan` requires `user_requirements`; `execute`,
  `simplify`, `review` require `plan`

### Hooks

- Registered via `ctx.register_hook(name, callback)`; callbacks receive
  **only their hook kwargs, never ctx** — capture ctx at register time
  (`hooks.init(ctx)`, `src/jovaltus/hooks.py:36-39`)
- `subagent_start` / `subagent_stop` are **no-ops unless the child belongs
  to the plugin's own pipeline** — determinism guard (`hooks.py:42-88`)
- `pre_llm_call` returns `{"context": <status line>}` when a pipeline
  exists, else `None` (`hooks.py:91-104`)

### State machine

- `state.py` uses only stdlib + `fabricium.state` — never imports ctx or
  Hermes APIs
- Persistence: `~/.hermes/jovaltus_state.json` via
  `fabricium.state.load_state("jovaltus")` / `save_state`; pipeline state
  under the `"pipeline"` key, `"profiles"` key never touched
- `to_dict()` / `from_dict()` round-trip must be lossless (cross-session
  resume)

### Goal markers and prompt substitution

- Every dispatched child's goal contains the marker
  `[jovaltus-pipeline:<tool>:<phase>]` — `subagent_start` matches it to
  associate the child with the pipeline (`hooks.py:359-371`)
- Prompt substitution is **`str.replace` on `[[token]]`** — never
  `.format()` (prompt bodies contain mermaid `{}` braces;
  `src/jovaltus/tools.py:340-352`). Tokens: `[[run_dir]]`, `[[repo_root]]`,
  `[[user_requirements]]` (prd), `[[plan_path]]` (execute/simplify/review)
- **Every prompt starts with Step 0: read the repository** at
  `[[repo_root]]` (AGENTS.md, manifest, source layout, tests) so the
  child's artifact is grounded in real code
- **Subagents inherit the main agent's toolset**: never pass
  `allowed_toolsets` to `SubagentLaunchRequest` (None → Hermes inherits the
  parent's enabled toolsets, `delegate_tool.py:1392-1395`); an explicit
  list would restrict the subagent

## Skill Conventions

| Convention | Detail |
|-----------|--------|
| YAML frontmatter | Required: `name`, `description` only (no author/version/metadata) |
| Utility naming | Non-verb nouns: `agentic-debugging`, `manage-agents-md`, `manage-git-repo`, `project-documentation`, `qa` |
| No pipeline skills | The 5 bundled skills are standalone utilities; pipeline phases live in `prompts/*.md`, not in skills |
| Progressive disclosure | Core content first; details in references/assets |
| Skill independence | Every skill loadable standalone; no hard dependency on prior skills |
| Description field | Must include LOAD/Do NOT use triggers for routing |

## Testing

| Convention | Detail |
|-----------|--------|
| `autouse` fixture clears state | `clear_task_state` fixture runs before every test |
| `git_repo` fixture creates temp repo | Isolated git repo per test via `tmp_path` |
| No mocking by default | Tests use real git repos and subprocess calls; fake ctx for tool/hook/register tests |
| State-machine tests in `test_state.py` | Transitions, resume, `"profiles"` preservation |
| Tool/hook/register tests | `test_tools.py`, `test_hooks.py`, `test_register.py` use a fake ctx |
| Integration tests in `tests/integration/` | Separate from unit tests |
| No eval harness | `tests/evals/` removed; behavioral gate is the Phase 7 Docker E2E |

## Commit Messages

Follow conventional commits where applicable. The CHANGELOG follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Security

- Never commit `.env` files
- No hardcoded API keys
- Pipeline state is local JSON (`~/.hermes/jovaltus_state.json`) — no secrets stored
- `execute` never commits to the repo — the working-tree diff is the review unit

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
