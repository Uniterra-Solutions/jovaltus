# Architecture — Jovaltus

Jovaltus is a Hermes plugin that bundles 13 agent skills for a complete
development pipeline. The plugin itself is minimal (~55 lines of Python);
all behavior is defined in skill documents.

## System Context (C4 Level 1)

```mermaid
graph TD
    Orchestrator[Orchestrator Agent] -->|skill_view| Skills[Bundled Skills]
    Orchestrator -->|dispatch| Subagent[Subagent Process]
    Subagent -->|git commit| Repo[Git Repository]
    Skills -->|guide| Orchestrator
    Subagent -->|read task| Worktree[Git Worktree]
```

**Users:** An orchestrator agent (human + LLM) that loads skills and follows
their guidance to drive the development pipeline.

**External services:**

| Service | Purpose | Protocol |
|---------|---------|----------|
| Hermes Agent Runtime | Host process; calls `register(ctx)` at startup | Python in-process |
| LLM Provider | Powers orchestrator + subagent reasoning | HTTP API |
| Git Repository | Source of truth; subagents commit to isolated worktrees | git CLI |
| Docker | Isolated environment for eval harness | Docker API |

## Container View (C4 Level 2)

```mermaid
graph TD
    Orch -->|skill_view| Skills[Bundled Skills 13x]
    Orch -->|dispatch| Sub[Subagent]
    Sub -->|git| WT[Worktree]
    Fabricium[Fabricium SDK] -->|HermesPlugin| CLI[CLI Commands]
    Fabricium -->|git_utils| Git[Git Ops]
    Fabricium -->|SkillEvalHarness| Eval[Eval Harness]
```

| Container | Technology | Purpose |
|-----------|-----------|---------|
| Bundled Skills | Markdown (SKILL.md) | 13 self-contained skill documents — pipeline phases + utilities |
| Orchestrator | Hermes agent | Loads skills, spawns subagents, controls pipeline flow |
| Subagent Process | Hermes subagent | Isolated execution in worktree; implements, reviews, tests |
| Fabricium SDK | `fabricium` pkg | `git_utils`, `HermesPlugin` (CLI + skill auto-discovery), `SkillEvalHarness` |
| CLI Commands | `hermes jovaltus setup\|status\|update` | Profile management + skill installation |

## Pipeline Flow (Skill-Driven)

```
jovaltus (core) → discuss → design → to-spec → to-tasks → execute → simplify → review → qa
```

The orchestrator loads one skill at a time. Each skill describes:
- **What** to produce at that phase
- **How** to produce it (step-by-step)
- **When** to move to the next phase (acceptance criteria)

No hardcoded pipeline engine. The orchestrator reads the skill, follows its
guidance, produces the artifact, then loads the next skill.

### Phase Details

| Phase | Skill | Input | Output | Subagents? |
|-------|-------|-------|--------|------------|
| 0 | `jovaltus` | User request | Routing decision (Direct / Utility / Pipeline) | No |
| 1 | `discuss` | User idea | `prd.md` | No |
| 2 | `design` | PRD | `design.md` | No |
| 3 | `to-spec` | PRD + design | Implementation specs | No |
| 4 | `to-tasks` | Specs | Manifest (task DAG) + task files | No |
| 5 | `execute` | Manifest + DAG | Worktrees + implemented code | Yes (level-parallel) |
| 6 | `simplify` | Implemented code | Simplified code (behaviour preserved) | Yes |
| 7 | `review` | Simplified code | Reviewed + merged code | Yes (per worktree) |
| 8 | `qa` | Merged code | QA report | Yes |

### DAG Execution Model

`to-tasks` expresses every subagent relationship as a **DAG** in the manifest:
tasks are nodes, directed edges are dependencies, and each task gets a
topological level (`1 + max(dep levels)`). `execute` dispatches level by
level — all tasks at the same level run simultaneously because file ownership
is proven disjoint within the level; levels run sequentially, and each
level's branches are merged into an integration branch so the next level's
subagents consume real prior output, not stubs. A zero-edge DAG (everything
at Level 1) is the classic fully-parallel run.

```
to-tasks produces the DAG manifest (nodes + edges + levels)
    → execute creates isolated worktrees per task
        → Level 1 tasks spawn simultaneously
            → levels merge into integration branch, next level spawns
                → all commit independently, zero merge conflicts per level
```

## Plugin Architecture

The plugin entry point (`src/jovaltus/__init__.py`, 55 lines):

```python
def _ensure_fabricium():
    # Self-bootstrap: pip install fabricium if missing
    # Survives Hermes venv recreation during updates

plugin = HermesPlugin(
    name="jovaltus",
    plugin_dir=_PLUGIN_DIR,
    default_profile="jovaltus-agent",
)

def register(ctx):
    plugin.register(ctx)  # Fabricium handles: CLI commands + skill discovery
```

**What Fabricium handles:**
- CLI command registration (`setup`, `status`, `update`, `update --check`)
- Bundled skill auto-discovery from `src/jovaltus/skills/`
- Git operations via `fabricium.git_utils`
- Eval harness via `fabricium.evals.SkillEvalHarness`

**What the plugin does NOT do (unlike v0.5.x):**
- No tool handlers — no `jovaltus_implement`, `jovaltus_verify`, `jovaltus_simplify`
- No state machine — no `state.py`, no stage tracking
- No hooks — no `hooks.py`, no guidance injection
- No subagent spawning from the plugin — skills direct the orchestrator to
  dispatch subagents itself (one per task, locked to its worktree)

## Key Architectural Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Skill-driven, not engine-driven | Pipeline flexibility; skills editable without touching Python | Active |
| DAG execution | Same-level tasks parallel (disjoint ownership); cross-level sequential via integration merges | Active |
| Fabricium as sole dependency | Avoids duplicating git wrappers, CLI registration, and skill bundling | Active |
| Self-bootstrap fabricium on import | Hermes may recreate venv, dropping plugin deps; repair on first import | Active |
| Minimal plugin (< 60 lines) | Plugin is glue; skills contain all behavior | Active |
| Worktree isolation per task | Prevents cross-task contamination; enables true parallelism | Active |
| Interface contracts in TASK.md | Eliminates cross-task runtime dependencies | Active |

## Deployment

Jovaltus is distributed as a pip-installable Hermes plugin via PyPI (trusted publisher).

```
CI/CD → git tag → PyPI trusted publisher → pip install jovaltus
```

`hermes jovaltus setup` creates the `jovaltus-agent` profile, installs bundled
skills, and optionally applies `SOUL.md`.

## How to Update

- New skill added? → Add to Phase Details table + Pipeline Flow diagram
- Pipeline order changes? → Update flow diagram + phase numbering
- Plugin API changes? → Update Plugin Architecture section
- Fabricium API changes? → Update Container View

## Find It Fast

```bash
ls src/jovaltus/skills/                      # All bundled skills
cat src/jovaltus/__init__.py                 # Plugin entry (55 lines)
grep -rn 'register' src/jovaltus/__init__.py # Registration logic
```
