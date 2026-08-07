# Jovaltus v0.7 Refactor — Task Decomposition (tasks.md)

Date: 07-08-2026
Status: Planning (authoritative for task dispatch)
Source: `.plan/07-08-2026/jovaltus-subagent-architecture/requirements.md`

## Execution Model

- The orchestrator runs tasks **sequentially in the main working tree** (no worktrees).
- One subagent per task. Each task owns its code **and** its tests (tests travel with implementation).
- `level(T) = 1 + max(level of deps)`; same-level tasks have **disjoint write ownership**.
- Every verification command runs from the repo root (`/Users/tszkinlai/uniterra/jovaltus`) via `uv run`.
- No new dependencies. No edits to fabricium, Hermes core, `uv.lock`, or `.pre-commit-config.yaml`.
- The **Fixed API Contract below is pinned by T1** and is immutable for T2–T4 — do not rename or reshape it without a new planning round.

## Fixed API Contract (pinned in T1)

### 1. Tool schemas — registered via `ctx.register_tool(name, toolset, schema, handler, ...)`

Handler invocation is `handler(args, **kwargs)` (verified `tools/registry.py:777`). `args` is the tool-call arguments dict. `toolset="jovaltus"` for all four. `is_async=False`.

| tool | schema (`properties` + `required`) | description (must contain) |
|------|-------------------------------------|----------------------------|
| `plan` | `{"type":"object","properties":{"user_requirements":{"type":"string"}},"required":["user_requirements"]}` | "Start the Jovaltus planning pipeline…" |
| `execute` | `{"type":"object","properties":{"plan":{"type":"string"}},"required":["plan"]}` | "Execute the task DAG in <plan>…" |
| `simplify` | `{"type":"object","properties":{"plan":{"type":"string"}},"required":["plan"]}` | "Simplify the changes for <plan>…" |
| `review` | `{"type":"object","properties":{"plan":{"type":"string"}},"required":["plan"]}` | "Adversarially review the changes for <plan>…" |

Handlers (in `tools.py`): `plan_handler(args, **kwargs) -> str`, `execute_handler(args, **kwargs) -> str`, `simplify_handler(args, **kwargs) -> str`, `review_handler(args, **kwargs) -> str`.

Return contract (JSON string): on success `{"status":"started","tool":"<tool>","phase":"<first-phase>","run_dir":"<abs>","message":"…"}`; on invalid input `{"status":"error","message":"…"}` (e.g. `plan` path missing for execute/simplify/review).

### 2. Hooks — registered via `ctx.register_hook(hook_name, callback)`

Hook callbacks are invoked as `cb(**kwargs)` — they receive **only the hook kwargs, never ctx** (verified `plugins.py:1936`). The plugin captures `ctx` at register time: `hooks.init(ctx)` stores it in a module-level `_CTX`.

| hook | callback | kwargs (verified `tools/delegate_tool.py`) | return contract |
|------|----------|--------------------------------------------|-----------------|
| `subagent_start` | `on_subagent_start(**kwargs) -> None` | `parent_session_id, parent_turn_id, parent_subagent_id, child_session_id, child_subagent_id, child_role, child_goal` (`delegate_tool.py:1598-1607`) | None; associates child via goal marker (see §5) |
| `subagent_stop` | `on_subagent_stop(**kwargs) -> None` | `parent_session_id, parent_turn_id, child_session_id, child_role, child_summary, child_status, tool_call_history, duration_ms` (`delegate_tool.py:2699-2711`) | None; advances the state machine and dispatches the next subagent |
| `pre_llm_call` | `on_pre_llm_call(**kwargs) -> dict \| None` | (any) | `{"context": "<status line>"}` when a pipeline exists, else `None` (verified `plugins.py:1919-1929` — injected into the user message, never the system prompt) |

**No-op rule (determinism):** `subagent_start`/`subagent_stop` are no-ops unless the child belongs to the plugin's own pipeline (see §5). Children of an execute-orchestrator's grandchildren, other plugins' children, and user-initiated subagents never touch pipeline state.

### 3. `state.py` public API (exact names — tools.py/hooks.py import these)

State file: fabricium-managed `~/.hermes/jovaltus_state.json` via `fabricium.state.load_state("jovaltus")` / `save_state("jovaltus", s)` (same functions `test_sync.py` monkeypatches). Pipeline state lives under top-level key **`"pipeline"`**; the **`"profiles"` key must never be touched** (fabricium-owned; `test_sync.py` depends on it).

```python
PHASES: tuple[str, ...] = ("prd", "research", "acceptance", "tasks",
                           "execute", "simplify", "simplify_fix",
                           "review", "review_fix")
STATUSES: tuple[str, ...] = ("idle", "running", "done", "failed")

@dataclass
class PipelineState:
    run_dir: str                       # abs path to .plan/<DD-MM-YYYY>/<slug>/
    tool: str                          # "plan" | "execute" | "simplify" | "review"
    phase: str                         # one of PHASES
    status: str                        # one of STATUSES
    user_requirements: str
    plan_path: str | None              # required for execute/simplify/review
    active_child_session_id: str | None
    loop_iteration: int                # simplify/review loop counter (no cap)
    verdict: str | None                # "pass" | "fix" | None
    updated_at: str                    # ISO timestamp
    error: str | None
    # to_dict() / from_dict() round-trip must be lossless

def get_pipeline() -> PipelineState | None          # None when idle; reads from disk
def start_pipeline(tool, run_dir, user_requirements="", plan_path=None) -> PipelineState  # overwrites any existing pipeline; status="running"; phase=<first phase of tool>
def set_phase(p, phase) -> None                     # updates + persists
def register_child(p, child_session_id) -> None     # sets active_child_session_id; persists
def complete_child(p, child_session_id, status, summary) -> bool
    # True only if child_session_id == active_child_session_id (and clears it);
    # on non-"success" status sets status="failed", error=summary. Persists.
def set_verdict(p, verdict) -> None                 # "pass"|"fix"; persists
def finish_pipeline(p, ok, error=None) -> None      # status="done"|"failed"; persists
def status_text(p) -> str
    # e.g. "[Jovaltus pipeline] tool=plan phase=research status=running run_dir=<abs>"
    #      "[Jovaltus pipeline] tool=plan phase=done status=done run_dir=<abs> — plan complete: <run_dir>/tasks.md"
def reset_pipeline() -> None                        # removes the "pipeline" key; persists
```

Phase sequences (chain table — hooks and tools both rely on it):
- `plan`: prd → research → acceptance → tasks → done
- `execute`: execute → done
- `simplify`: simplify → (verdict "fix" → simplify_fix → simplify) → done
- `review`: review → (verdict "fix" → review_fix → review) → done

### 4. `prompts/` contract

`src/jovaltus/prompts/` is a Python package:

```python
PROMPT_NAMES: tuple[str, ...]
def load_prompt(name: str) -> str      # reads prompts/<name>.md; FileNotFoundError for unknown names
```

Files (exact names) and their token placeholders — substitution is **`str.replace` on `[[token]]`** (never `.format()` — prompt bodies contain mermaid `{}` braces):

| file | tokens | artifact the subagent must write into `run_dir` |
|------|--------|-------------------------------------------------|
| `prd.md` | `[[run_dir]]`, `[[user_requirements]]` | `prd.md` |
| `research.md` | `[[run_dir]]` | `design.md` |
| `acceptance.md` | `[[run_dir]]` | `acceptance.md` |
| `tasks.md` | `[[run_dir]]` | `tasks.md` (task DAG manifest: serial / batch / fully-parallel forms + mermaid DAG) |
| `execute.md` | `[[run_dir]]`, `[[plan_path]]` | none (orchestrator executes the DAG; **must instruct: no git commits — leave the diff for simplify/review**; read repo AGENTS.md; level-by-level, same-level tasks in parallel) |
| `simplify-review.md` | `[[run_dir]]`, `[[plan_path]]` | `verdict.json` `{"verdict": "pass"|"fix", "findings": "…"}` |
| `simplify-fix.md` | `[[run_dir]]`, `[[plan_path]]` | none (applies simplification suggestions, then reviewer re-runs) |
| `review.md` | `[[run_dir]]`, `[[plan_path]]` | `verdict.json` (same shape — adversarial review findings) |
| `review-fix.md` | `[[run_dir]]`, `[[plan_path]]` | none |

### 5. Dispatch contract (tools.py helper shared with hooks.py)

- `dispatch_pipeline_step(p: PipelineState, phase: str) -> dict` in `tools.py`:
  1. `goal = load_prompt(<prompt for phase>)` with tokens replaced; goal **must contain the marker** `[jovaltus-pipeline:<tool>:<phase>]`.
  2. `ctx.dispatch_tool("delegate_task", {"goal": goal, "context": context, "role": "leaf" | "orchestrator"})` — `role="orchestrator"` ONLY for the execute phase.
     **VERIFIED SIGNATURE** (`tools/delegate_tool.py:2779-2787`): accepted params are
     `goal, context, tasks, max_iterations, role, background, parent_agent`. Do NOT pass
     `workspace_path` or `max_spawn_depth` — they are silently ignored by the registry
     handler. The child's workspace is inherited automatically from the parent agent
     (`delegate_tool.py:1322 workspace_path=workspace_hint`); pass the repo root inside
     `context` text instead. `background` is auto-computed (`_model_background_value`):
     True for main-agent depth 0 → fire-and-forget `{"status":"dispatched","delegation_id":...}`.
  3. Repo root must be passed in `context` (e.g. `## Repo root\n/abs/path`) — NOT as a
     tool parameter.
  4. Parse the returned JSON; on `status == "dispatched"` set `pipeline.pending_role = phase` (recorded in state; see §6) and return the parsed dict.
- **Orchestrator nesting precondition (execute):** the execute orchestrator is a depth-1
  child; for it to spawn its own workers, the host config MUST have
  `delegation.max_spawn_depth >= 2` AND `delegation.orchestrator_enabled` not false
  (`delegate_tool.py:595-606, 2830`). `execute_handler` must CHECK the effective
  `max_spawn_depth` (read config.yaml or `hermes config get delegation.max_spawn_depth`)
  BEFORE dispatching; if `< 2`, return `{"status":"error","message":"execute requires delegation.max_spawn_depth >= 2"}`.
  The plugin NEVER edits the user's config automatically — it declares the precondition
  and returns a clear error. Phase 7 Docker E2E sets `delegation.max_spawn_depth: 2` in
  the copied temp config so the full chain is exercised.
- **Association:** `subagent_start` matches `child_goal` containing `[jovaltus-pipeline:<tool>:<phase>]` against the pipeline whose next expected phase matches, then `register_child(p, child_session_id)` and clears the pending marker. No marker match → no-op.
- **Advance:** `subagent_stop` acts only when `complete_child(...)` returns True: for simplify/review phases it reads `<run_dir>/verdict.json` → `set_verdict`; "pass" → `finish_pipeline(ok=True)`; "fix" → `set_phase(simplify_fix|review_fix)`, dispatch fixer; after a fixer completes → back to reviewer phase. **No iteration cap** (decision #1). plan/execute chains follow the chain table. On failure → `finish_pipeline(ok=False, error=child_summary)`.
- **Run dir rule (plan tool):** `<cwd>/.plan/<DD-MM-YYYY>/<slug>/`; `slug` = sanitized kebab-case of the first ~6 words of `user_requirements` (fallback `"plan"`); if it exists, append `-2`, `-3`, …

### 6. `__init__.py` register() flow (final)

1. `plugin.register(ctx)` — fabricium CLI (`setup|status|update`) + bundled skills (unchanged).
2. `tools.register(ctx)` — registers the 4 tools (§1).
3. `hooks.init(ctx)` + `ctx.register_hook("subagent_start", hooks.on_subagent_start)` + `("subagent_stop", hooks.on_subagent_stop)` + `("pre_llm_call", hooks.on_pre_llm_call)`.

### 7. Cross-cutting decisions (pinned here)

- **Evals decision:** DELETE `tests/evals/` entirely (conftest.py, tasks.py, rubrics.py, test_jovaltus_skills.py — 4 tests). Rationale: `SkillEvalHarness` (fabricium, unmodifiable) measures *skill lift* between bare and jovaltus-agent profiles; with the 9 pipeline skills deleted there is no skill pipeline to lift, and Phase 7 Docker E2E supersedes it as the behavioral gate. Test baseline: **39 → 35**.
- **Version bump:** `0.14.2` → **`1.0.0`** (breaking change; `v0.7.0` would be a *downgrade* below the current 0.14.2 and break pip/PyPI ordering). Lands in T4. `git tag` + push + PyPI release is the orchestrator's post-gate step (manage-git-repo Workflow B), NOT a task.
- **Import strategy:** new modules import each other as `jovaltus.state`, `jovaltus.tools`, `jovaltus.hooks`, `jovaltus.prompts` (src layout, uv-managed, mypy strict). No module imports `jovaltus/__init__.py` (no circular imports).
- **Behavior preservation:** CLI `hermes jovaltus setup|status|update` must keep working; `tests/test_git_utils.py`, `tests/test_sync.py`, `tests/integration/test_cli.py` stay green and unmodified.

---

## T1 — State machine + prompts + unit tests

- **Goal:** implement the deterministic state machine (`state.py`) and the subagent prompt library (`prompts/`), pinning the Fixed API Contract above; unit tests for transitions and cross-session resume.
- **Level:** 1 (no deps).
- **Ownership (writes):**
  - CREATE `src/jovaltus/state.py`
  - CREATE `src/jovaltus/prompts/__init__.py`
  - CREATE `src/jovaltus/prompts/prd.md`, `research.md`, `acceptance.md`, `tasks.md`, `execute.md`, `simplify-review.md`, `simplify-fix.md`, `review.md`, `review-fix.md`
  - CREATE `tests/test_state.py`
  - READ (context only): `requirements.md`, `fabricium/state.py` (load/save API shape), `tests/test_sync.py` (monkeypatch pattern to mirror)
- **Verification (repo root, all must pass):**
  - `uv run pytest tests/test_state.py -v`
  - `uv run ruff check src/jovaltus/state.py src/jovaltus/prompts tests/test_state.py`
  - `uv run ruff format --check src/jovaltus/state.py src/jovaltus/prompts tests/test_state.py`
  - `uv run mypy`
- **Acceptance:**
  - `state.py` exposes exactly the API in Contract §3 (names, signatures, PHASES/STATUSES, PipelineState fields).
  - `test_state.py` covers: idle → `get_pipeline() is None`; `start_pipeline("plan", …)` → phase `prd`, status `running`; `set_phase`/`register_child`/`set_verdict`/`finish_pipeline`/`reset_pipeline` round-trips; `complete_child` returns False for a non-matching `child_session_id` and True for the matching one; `complete_child` with non-success status → status `failed`, error recorded; **cross-session resume**: save under a monkeypatched `_get_global_hermes_home` (tmp dir), then a fresh `get_pipeline()` call re-reads the same phase, `active_child_session_id`, `loop_iteration`, `verdict` from JSON; **`"profiles"` key preservation**: writing pipeline state never clobbers an existing `"profiles"` dict.
  - `load_prompt` returns non-empty markdown for all 9 names and raises `FileNotFoundError` for an unknown name; every prompt file contains its `[[…]]` tokens per Contract §4 and the `execute.md` prompt contains an explicit "do not commit" instruction.
  - `state.py` uses only stdlib + `fabricium.state`; no `ctx`/Hermes imports.

## T2 — Tools + hooks + registration wiring

- **Goal:** implement the 4 tool handlers and 3 hook callbacks, wire registration in `__init__.py`, with unit tests using a fake ctx.
- **Level:** 2 (dep: T1).
- **Ownership (writes):**
  - CREATE `src/jovaltus/tools.py`
  - CREATE `src/jovaltus/hooks.py`
  - CREATE `tests/test_tools.py`, `tests/test_hooks.py`, `tests/test_register.py`
  - EDIT `src/jovaltus/__init__.py` (per Contract §6 — keep `_ensure_fabricium`, the `plugin` instance, and `plugin.register(ctx)` call intact)
  - READ (context only): `requirements.md` API facts; `plugins.py:410-461` (register_tool), `plugins.py:1177-1192` (register_hook), `plugins.py:1911-1945` (pre_llm_call return contract), `delegate_tool.py:789-833` (goal/context/workspace_path/role), `delegate_tool.py:1580-1612` (subagent_start kwargs), `delegate_tool.py:2649-2735` (subagent_stop kwargs)
- **Verification (repo root, all must pass):**
  - `uv run pytest tests/test_tools.py tests/test_hooks.py tests/test_register.py -v`
  - `uv run pytest -v` (full suite: existing 39 + new tests — all green)
  - `uv run ruff check .` and `uv run ruff format --check .`
  - `uv run mypy`
- **Acceptance:**
  - Fake-ctx unit tests (`test_tools.py`): `plan_handler` computes the run dir per Contract §5, calls `ctx.dispatch_tool("delegate_task", …)` with a goal containing `[jovaltus-pipeline:plan:prd]`, and returns the §1 JSON shape; `execute_handler`/`simplify_handler`/`review_handler` dispatch with the given `plan` path and return `{"status":"error",…}` when `plan` is missing or the path does not exist; handler signatures are `(args, **kwargs)`.
  - `test_hooks.py`: `on_subagent_start` with a goal containing a matching marker records `active_child_session_id`; with a non-matching goal it is a no-op; `on_subagent_stop` with a matching `child_session_id` advances the chain per Contract §5 (plan: prd→research dispatch with `research.md`; last plan phase → `finish_pipeline(ok=True)` and **no** further dispatch); with a non-matching id it is a no-op (orchestrator grandchildren case); simplify/review: verdict file `pass` → done, `fix` → fixer dispatched then reviewer re-dispatched (loop iteration increments, no cap); non-success child status → `finish_pipeline(ok=False, error=…)`; `on_pre_llm_call` returns `{"context": …}` when a pipeline exists and `None` when idle.
  - `test_register.py`: `register(fake_ctx)` calls `plugin.register(ctx)` (CLI/skills preserved) and registers exactly the 4 tools `plan|execute|simplify|review` (toolset `jovaltus`, schemas with `required` per §1) and exactly the 3 hooks `subagent_start|subagent_stop|pre_llm_call`, with **no exceptions**.
  - `__init__.py` keeps `_ensure_fabricium()` and the module-level `plugin` (tests/test_sync.py imports `jovaltus.plugin` — must keep working).

## T3 — Skill cleanup + evals removal

- **Goal:** shrink bundled skills 13 → 5, rewrite the `qa` skill for standalone acceptance testing, update the `project-documentation` architecture template, delete the evals suite (decision pinned in Contract §7).
- **Level:** 1 (no deps; may run before or after T2).
- **Ownership (writes):**
  - DELETE `src/jovaltus/skills/jovaltus/`, `src/jovaltus/skills/discuss/`, `src/jovaltus/skills/design/`, `src/jovaltus/skills/to-spec/`, `src/jovaltus/skills/to-tasks/`, `src/jovaltus/skills/execute/`, `src/jovaltus/skills/simplify/`, `src/jovaltus/skills/review/` (whole directories incl. assets/references)
  - DELETE `tests/evals/` (conftest.py, tasks.py, rubrics.py, test_jovaltus_skills.py)
  - EDIT `src/jovaltus/skills/qa/SKILL.md` — rewrite `description` (and body where needed) as **standalone acceptance testing** (PRD-driven journeys, app-type agnostic); remove all pipeline-phase wording ("review phase", "All worktrees merged", "final gate before shipping")
  - EDIT `src/jovaltus/skills/project-documentation/templates/architecture.md.tmpl` — replace pipeline references with the new subagent-driven framework (4 tools + state machine + hooks) so future generated docs match v1.0.0
  - READ (context only): `requirements.md` inventory, `docs/architecture.md` (template parity)
- **Verification (repo root, all must pass):**
  - `uv run pytest -v` → **35 tests** collected (39 − 4 evals), all green
  - `uv run ruff check .` and `uv run ruff format --check .` and `uv run mypy`
  - `ls src/jovaltus/skills/` → exactly: `agentic-debugging manage-agents-md manage-git-repo project-documentation qa`
- **Acceptance:**
  - Exactly 5 skill directories remain; the 8 pipeline dirs are gone from `git status` as deletions.
  - `tests/evals/` no longer exists; `uv run pytest --collect-only -q` reports 35.
  - `qa` frontmatter description contains no pipeline-phase vocabulary (`grep -iE "review phase|worktree|pipeline" src/jovaltus/skills/qa/SKILL.md` → exit 1) and describes standalone PRD-driven acceptance testing.
  - The 4 kept utility skills (`agentic-debugging`, `manage-agents-md`, `manage-git-repo`, `project-documentation` SKILL.md) are **byte-identical** to baseline (`git diff --stat` shows no changes to them).
  - `architecture.md.tmpl` describes the 4-tool/subagent-driven architecture, not the 13-skill pipeline.

## T4 — Docs (Phase 6) + release metadata

- **Goal:** update every repo doc that references the skill-driven pipeline; bump version to 1.0.0 with a CHANGELOG entry.
- **Level:** 3 (deps: T2 + T3 — docs must describe the implemented framework and final skill set).
- **Ownership (writes):**
  - EDIT `docs/architecture.md` — rewrite: 4 tools + state machine + hooks architecture, system/container context, phase chains, no pipeline flow
  - EDIT `docs/project-structure.md` — module layout (`state.py`, `tools.py`, `hooks.py`, `prompts/`), 5 skills, test layout (evals removed)
  - EDIT `docs/workflows.md` — replace "Running the Full Pipeline" with tool-driven recipes (plan → execute → simplify → review), test commands, version workflow
  - EDIT `docs/conventions.md` — Plugin Pattern section (tools/hooks/state conventions), Skill Conventions (5 skills, no verb-form pipeline), Testing table (evals removed)
  - EDIT `docs/testing.md` — drop/replace the eval-harness section; reference Phase 7 Docker E2E as the behavioral gate
  - EDIT `docs/tech-stack.md` — remove/replace `SkillEvalHarness` references
  - EDIT `docs/README.md` — summary line (5 skills, 4 tools), quick links/anchor names
  - EDIT `docs/modules/plugin-entry.md` — register() flow with 4 tools + 3 hooks; skill auto-discovery table → 5 rows; module boundaries (no more "only __init__.py")
  - EDIT `README.md` — root summary, install/usage (tools + CLI), architecture blurb
  - EDIT `AGENTS.md` — architecture section (skill-driven → subagent-driven), skills count 13 → 5, test count 39 → 35
  - EDIT `pyproject.toml` — `version = "1.0.0"`, description updated (drop "pipeline skills")
  - EDIT `src/jovaltus/plugin.yaml` — `version: 1.0.0`, description updated
  - EDIT `CHANGELOG.md` — add `## v1.0.0` entry (Keep a Changelog format) summarizing the refactor
  - READ (context only): this plan, `requirements.md` (File Contracts, Phase 7 wording), all docs being edited
- **Verification (repo root, all must pass):**
  - `uv run pytest -v` (35, green) and `uv run ruff check .` and `uv run ruff format --check .` and `uv run mypy`
  - `grep -rn -iE "skill-driven|discuss|to-spec|to-tasks|13 bundled|13 skills|9 pipeline" README.md AGENTS.md docs/` → **no matches** (exit 1; `CHANGELOG.md` exempt — it records history)
  - `grep -n "^version" pyproject.toml src/jovaltus/plugin.yaml` → both `1.0.0`
- **Acceptance:**
  - Every file above references the subagent-driven framework (4 tools, state machine, hooks) and the 5-skill bundle; no stale pipeline wording remains (grep check above).
  - `docs/modules/plugin-entry.md` documents the register() flow of Contract §6 including tool/hook registration.
  - `AGENTS.md` reflects the new architecture and the 35-test baseline.
  - Version is 1.0.0 in both metadata files; CHANGELOG has a v1.0.0 entry.
  - `docs/setup.md` requires no change (no pipeline references) — leave untouched.
  - `.plan/07-08-2026/jovaltus-subagent-architecture/` (requirements.md, tasks.md, acceptance.md) is READ-ONLY — not modified by any task.

## Recommended Execution Order

```
T1 (state+prompts) → T2 (tools+hooks+register) → T3 (skills+evals) → T4 (docs+version)
```

- T1 must precede T2 (contract). T3 is independent of T1/T2 and may run in either slot (e.g. T1 → T3 → T2 → T4).
- T4 must be last (depends on the implemented framework and final skills set).
- Suggested commit policy: one commit per task so the T1 contract diff is independently reviewable. Version bump commits only in T4. No `git tag` until after the Phase 7 Docker E2E gate (see acceptance.md).
