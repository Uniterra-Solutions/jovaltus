# Plugin Entry

**Purpose:** Hermes plugin registration entry point — self-bootstraps fabricium,
delegates all registration to `HermesPlugin`, and serves as the single source
file for the entire plugin.

**Source:** `src/jovaltus/__init__.py` (55 lines) + `src/jovaltus/plugin.yaml`

## Public API

| Entity | Signature | Description |
|--------|-----------|-------------|
| `register(ctx)` | `(ctx: Any) -> None` | Main entry point; delegates to `plugin.register(ctx)` |
| `plugin` | `HermesPlugin(name="jovaltus", ...)` | Fabricium plugin instance (CLI + skills auto-discovered) |

## Registration Flow

```
Hermes starts
  → import jovaltus
    → _ensure_fabricium() — self-bootstrap if missing
    → from fabricium import HermesPlugin
    → plugin = HermesPlugin(name="jovaltus", ...)
  → jovaltus.register(ctx)
    → plugin.register(ctx)       — Fabricium handles everything:
        → CLI commands: setup, status, update, update --check
        → Skill auto-discovery from src/jovaltus/skills/
```

## Self-Bootstrap (`_ensure_fabricium`)

**Source:** `src/jovaltus/__init__.py:18-29`

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

No manual tool registration, no hook registration, no schema definitions.
The plugin is 55 lines of glue code.

## plugin.yaml

**Source:** `src/jovaltus/plugin.yaml` (4 lines)

```yaml
name: jovaltus
version: 0.6.0
description: Jovaltus Agent Mode — automated development pipeline skills and CLI
author: LaiTszKin
```

No `provides_tools` section — v0.6.0 removed all plugin tools in favor of
skill-driven orchestration.

## Skill Auto-Discovery

Fabricium scans `src/jovaltus/skills/` and registers every `SKILL.md` it finds.
Skills are namespaced under the plugin name (e.g., `jovaltus:discuss`) but also
available via short name when loaded from a profile with the plugin enabled.

| Skill Directory | Registered Name | Type |
|----------------|-----------------|------|
| `skills/discuss/` | `discuss` | Pipeline |
| `skills/design/` | `design` | Pipeline |
| `skills/to-spec/` | `to-spec` | Pipeline |
| `skills/to-tasks/` | `to-tasks` | Pipeline |
| `skills/to-environment/` | `to-environment` | Pipeline |
| `skills/execute/` | `execute` | Pipeline |
| `skills/review/` | `review` | Pipeline |
| `skills/qa/` | `qa` | Pipeline |
| `skills/agentic-debugging/` | `agentic-debugging` | Utility |
| `skills/manage-agents-md/` | `manage-agents-md` | Utility |
| `skills/project-documentation/` | `project-documentation` | Utility |

## Module Boundaries

| Boundary | Rule |
|----------|------|
| Plugin code | Only `__init__.py` — no other Python modules |
| Behavior | Defined in skill documents (`SKILL.md`), not in Python |
| Git operations | Delegated to `fabricium.git_utils` |
| CLI parsing | Delegated to `fabricium.HermesPlugin` |
| Skill loading | Delegated to Hermes runtime via `skill_view()` |

## How to Update

- New CLI command? → May require fabricium update; plugin code stays minimal
- Skill added/removed? → Update Skill Auto-Discovery table
- `plugin.yaml` changes? → Update plugin.yaml section
- Bootstrap logic changes? → Update Self-Bootstrap section

## Find It Fast

```bash
cat src/jovaltus/__init__.py                       # Full plugin (55 lines)
cat src/jovaltus/plugin.yaml                        # Plugin metadata (4 lines)
ls src/jovaltus/skills/                             # All bundled skills
```
