# Plugin Entry

**Purpose:** Hermes plugin registration entry point — self-bootstraps
fabricium, registers CLI commands + bundled skills via `HermesPlugin`, then
registers the 4 pipeline tools and 3 hook callbacks.

**Source:** `src/jovaltus/__init__.py` (67 lines) + `src/jovaltus/plugin.yaml`

## Public API

| Entity | Signature | Description |
|--------|-----------|-------------|
| `register(ctx)` | `(ctx: Any) -> None` | Main entry point: fabricium registration + 4 tools + 3 hooks |
| `plugin` | `HermesPlugin(name="jovaltus", ...)` | Fabricium plugin instance (CLI + skills auto-discovered) |

## Registration Flow

```python
def register(ctx: Any) -> None:                     # src/jovaltus/__init__.py:46-67
    plugin.register(ctx)                            # fabricium: CLI + skills (line 56)
    jovaltus_tools.register(ctx)                    # 4 tools (line 61)
    jovaltus_hooks.init(ctx)                        # capture ctx for hooks (line 62)
    ctx.register_hook("subagent_start", jovaltus_hooks.on_subagent_start)  # line 63
    ctx.register_hook("subagent_stop", jovaltus_hooks.on_subagent_stop)    # line 64
    ctx.register_hook("pre_llm_call", jovaltus_hooks.on_pre_llm_call)      # line 65
```

```
Hermes starts
  → import jovaltus
    → _ensure_fabricium() — self-bootstrap if missing
    → from fabricium import HermesPlugin
    → plugin = HermesPlugin(name="jovaltus", ...)
  → jovaltus.register(ctx)
    → plugin.register(ctx)      — fabricium:
        → CLI commands: setup, status, update, update --check
        → Skill auto-discovery from src/jovaltus/skills/
    → tools.register(ctx)       — 4 tools: plan / execute / simplify / review
    → hooks.init(ctx) + 3 × ctx.register_hook
```

## Self-Bootstrap (`_ensure_fabricium`)

**Source:** `src/jovaltus/__init__.py:18-28`

```python
def _ensure_fabricium() -> None:
    try:
        import fabricium
    except ImportError:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "fabricium"],
            check=True, capture_output=True,
        )
        sys.modules.pop("fabricium", None)
```

Hermes manages its own venv and may recreate it during updates, dropping
plugin-only dependencies. This guard ensures fabricium is installed on first
import after a Hermes update without requiring a manual pip install.

## Plugin Instance

**Source:** `src/jovaltus/__init__.py:39-43`

```python
plugin = HermesPlugin(
    name="jovaltus",
    plugin_dir=_PLUGIN_DIR,           # Path(__file__).parent
    default_profile="jovaltus-agent",
)
```

`HermesPlugin` auto-discovers:
- **CLI commands**: `setup`, `status`, `update`, `update --check` — built into Fabricium
- **Bundled skills**: All `SKILL.md` files under `src/jovaltus/skills/`
- **Git operations**: Via `fabricium.git_utils`

## Tool Registration (`tools.register`)

**Source:** `src/jovaltus/tools.py:85-140`

All four tools use `toolset="jovaltus"`, `is_async=False`, and handler
signature `handler(args, **kwargs) -> str` (JSON result string):

| Tool | Schema (`required`) | Handler | Description |
|------|---------------------|---------|-------------|
| `plan` | `{"user_requirements": ...}` | `plan_handler` (`tools.py:295-310`) | USE WHEN the user wants a software-engineering request turned into an implementation plan (or needs planning for a complex request). Runs PRD → research → acceptance → task DAG |
| `execute` | `{"plan": ...}` | `execute_handler` (`tools.py:312-329`) | USE WHEN a plan exists and you want to implement its software-engineering work. Requires `delegation.max_spawn_depth >= 2` |
| `simplify` | `{"plan": ...}` | `simplify_handler` (`tools.py:331-346`) | USE WHEN the plan's implementation exists and you want its code simplified |
| `review` | `{"plan": ...}` | `review_handler` (`tools.py:348-363`) | USE WHEN the plan's implementation exists and you want its code reviewed |

## Hook Registration (`hooks.init`)

**Source:** `src/jovaltus/hooks.py:36-39` (init), `42-63` (start),
`65-88` (stop), `91-104` (pre_llm_call)

| Hook | Callback | Behavior |
|------|----------|----------|
| `subagent_start` | `on_subagent_start(**kwargs) -> None` | Associates a child whose goal contains `[jovaltus-pipeline:<tool>:<phase>]` via `register_child`; no marker match → no-op |
| `subagent_stop` | `on_subagent_stop(**kwargs) -> None` | Advances the chain when the active child completes; non-success status fails the pipeline |
| `pre_llm_call` | `on_pre_llm_call(**kwargs) -> dict \| None` | Returns `{"context": "<status line>"}` when a pipeline exists, else `None` |

## plugin.yaml

**Source:** `src/jovaltus/plugin.yaml` (4 lines)

```yaml
name: jovaltus
version: 1.0.0
description: "Jovaltus Agent Mode — subagent-driven development framework: plan / execute / simplify / review tools, state machine, and hooks"
author: LaiTszKin
```

Tools and hooks are registered in Python (`tools.register`, `hooks.init`)
— `plugin.yaml` carries no tool declarations.

## Skill Auto-Discovery

Fabricium scans `src/jovaltus/skills/` and registers every `SKILL.md` it finds.
Skills are namespaced under the plugin name (e.g., `jovaltus:qa`) but also
available via short name when loaded from a profile with the plugin enabled.

| Skill Directory | Registered Name | Type |
|----------------|-----------------|------|
| `skills/agentic-debugging/` | `agentic-debugging` | Utility |
| `skills/manage-agents-md/` | `manage-agents-md` | Utility |
| `skills/manage-git-repo/` | `manage-git-repo` | Utility |
| `skills/project-documentation/` | `project-documentation` | Utility |
| `skills/qa/` | `qa` | Utility |

## Module Boundaries

| Boundary | Rule |
|----------|------|
| `__init__.py` | Registration only: fabricium + `tools.register(ctx)` + `hooks.init(ctx)` + 3 `ctx.register_hook` calls |
| `tools.py` | 4 tool handlers, `CHAIN` table, `dispatch_pipeline_step`; imports `jovaltus.state` + `jovaltus.prompts` |
| `hooks.py` | 3 hook callbacks; imports `jovaltus.state` + `jovaltus.tools` (CHAIN, dispatch) |
| `state.py` | Deterministic state machine; stdlib + `fabricium.state` only — never imports ctx or Hermes APIs |
| `prompts/` | `PROMPT_NAMES` + `load_prompt(name)`; 9 Markdown goal documents with `[[token]]` placeholders |
| Git operations | Delegated to `fabricium.git_utils` |
| CLI parsing | Delegated to `fabricium.HermesPlugin` |
| Skill loading | Delegated to Hermes runtime; the plugin never navigates skills itself |

## How to Update

- New tool added? → Update Tool Registration table + `tools.register`
- New hook added? → Update Hook Registration table + `hooks.init`
- Skill added/removed? → Update Skill Auto-Discovery table
- `plugin.yaml` changes? → Update plugin.yaml section
- Bootstrap logic changes? → Update Self-Bootstrap section

## Find It Fast

```bash
cat src/jovaltus/__init__.py                       # Full plugin (67 lines)
cat src/jovaltus/plugin.yaml                       # Plugin metadata (4 lines)
cat src/jovaltus/tools.py                          # 4 tool handlers + CHAIN
cat src/jovaltus/hooks.py                          # 3 hook callbacks
cat src/jovaltus/state.py                          # State machine
ls src/jovaltus/skills/                            # All bundled skills
```
