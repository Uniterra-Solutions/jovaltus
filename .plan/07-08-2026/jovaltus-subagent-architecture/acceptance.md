# Jovaltus v0.7 Refactor — Acceptance Criteria (acceptance.md)

Date: 07-08-2026
Status: Planning (orchestrator verification checklist)
Source: `.plan/07-08-2026/jovaltus-subagent-architecture/requirements.md` + `tasks.md`

Refactor goal: replace the skill-driven pipeline (13 bundled skills) with a **subagent-driven deterministic framework** — 4 plugin tools (`plan`, `execute`, `simplify`, `review`) dispatching subagents via `ctx.dispatch_tool("delegate_task", …)`, a plugin-owned state machine (`state.py` + JSON persistence for cross-session resume), and 3 hooks (`subagent_start`, `subagent_stop`, `pre_llm_call`) driving phase transitions deterministically and injecting pipeline status every turn.

---

## 0. Baseline (recorded 07-08-2026 by the planning subagent — evidence, not assumed)

Run from repo root `/Users/tszkinlai/uniterra/jovaltus`:

```
$ uv run pytest --collect-only -q
39 tests collected in 0.02s
```

Breakdown (actual, measured):

| file | tests |
|------|-------|
| `tests/test_git_utils.py` | 19 |
| `tests/test_sync.py` | 8 |
| `tests/integration/test_cli.py` | 8 |
| `tests/evals/test_jovaltus_skills.py` | 4 |
| **total** | **39** |

Post-refactor target: **35** (39 − 4 evals deleted; evals decision pinned in tasks.md Contract §7).

---

## 1. All checks green (final state gate — run all four from repo root)

| # | Command | Pass condition |
|---|---------|----------------|
| 1 | `uv run ruff check .` | exit 0, zero warnings |
| 2 | `uv run ruff format --check .` | exit 0, no files would be reformatted |
| 3 | `uv run mypy` | exit 0, zero errors (strict, `files = ["src/jovaltus"]`) |
| 4 | `uv run pytest -v` | exit 0, **35** tests collected, all pass |

## 2. Registration: 4 tools + 3 hooks, fabricium CLI intact

- `uv run pytest tests/test_register.py -v` passes: `register(fake_ctx)` calls `plugin.register(ctx)` **and** registers exactly the tools `plan`, `execute`, `simplify`, `review` (toolset `jovaltus`; schemas requiring `user_requirements` / `plan` respectively) and exactly the hooks `subagent_start`, `subagent_stop`, `pre_llm_call` — no exceptions.
- `uv run pytest tests/test_sync.py -v` still passes (8 tests): the fabricium `HermesPlugin` instance (`jovaltus.plugin`) and its `_sync_installed_profiles` are untouched; CLI commands `setup|status|update` remain registered via fabricium.
- Code inspection: `src/jovaltus/__init__.py` keeps `_ensure_fabricium()`, the module-level `plugin = HermesPlugin(...)`, and calls `plugin.register(ctx)` first (tasks.md Contract §6).
- Phase 7 (Docker) re-verifies live: `hermes plugins list` shows `jovaltus` enabled; `hermes jovaltus status` exits 0.

## 3. State machine: transitions + cross-session resume

- `uv run pytest tests/test_state.py -v` passes. Coverage required:
  - idle → `get_pipeline() is None`; `start_pipeline` → `phase="prd"`, `status="running"`; overwrites an existing pipeline.
  - phase transitions via `set_phase`; child bookkeeping via `register_child` / `complete_child` (returns False for non-matching `child_session_id`; records `status="failed"` + `error` on non-success).
  - `set_verdict` / `finish_pipeline` / `reset_pipeline` round-trips.
  - **Cross-session resume from JSON:** with `fabricium.state._get_global_hermes_home` monkeypatched to a tmp dir, save a running pipeline (phase, active child id, loop iteration, verdict), then simulate a new session by re-invoking `get_pipeline()` — the reloaded `PipelineState` is field-identical (lossless `to_dict`/`from_dict`).
  - **`"profiles"` key preservation:** pipeline writes never clobber fabricium's `"profiles"` dict in `~/.hermes/jovaltus_state.json`.
- The state file is the fabricium-managed `~/.hermes/jovaltus_state.json`; pipeline data lives under the `"pipeline"` key.

## 4. Pipeline determinism (main agent does not navigate skills)

- `ls src/jovaltus/skills/` → exactly 5 directories: `agentic-debugging manage-agents-md manage-git-repo project-documentation qa`. No pipeline skill remains (code inspection: the 8 pipeline dirs are absent).
- Code inspection of `src/jovaltus/tools.py` / `src/jovaltus/hooks.py` / `src/jovaltus/state.py`: no `skill_view`, no loading of `SKILL.md`, no skill-navigation guidance. `grep -rn "skill_view" src/jovaltus/*.py` → no matches.
- The 4 tool schemas exist in the registry (asserted by `tests/test_register.py`); tool handlers only *start* the first step of a chain; every subsequent step is dispatched from `on_subagent_stop` (code inspection: `hooks.py` calls `dispatch_pipeline_step` for the next phase; `subagent_start` associates children via the `[jovaltus-pipeline:<tool>:<phase>]` goal marker).
- `uv run pytest tests/test_hooks.py -v` passes, including: unknown `child_session_id` → no-op (orchestrator grandchildren / foreign children never move pipeline state); plan chain prd→research→acceptance→tasks→done with exactly one dispatch per stop; simplify/review verdict loop `pass`→done / `fix`→fixer→reviewer with **no iteration cap**; non-success child status → `status="failed"` with error recorded.
- `pre_llm_call` injects a status line (`{"context": "[Jovaltus pipeline] …"}`) whenever a pipeline exists, and returns `None` when idle (unit-tested in `test_hooks.py`; format per tasks.md Contract §3 `status_text`).

## 5. Utility skills survive; qa rewritten

- The 4 utility skills `agentic-debugging`, `manage-agents-md`, `manage-git-repo`, `project-documentation` are byte-identical to baseline (`git diff --stat` shows zero changes to their `SKILL.md`).
- `src/jovaltus/skills/qa/SKILL.md` is rewritten as **standalone acceptance testing**; `grep -iE "review phase|worktree|pipeline" src/jovaltus/skills/qa/SKILL.md` → no matches (exit 1); the frontmatter `description` describes PRD-driven acceptance testing usable on its own.
- `tests/evals/` is deleted (decision: evals measured skill lift for the deleted pipeline; Phase 7 Docker E2E is the behavioral gate).

## 6. Docs update (Phase 6) — verified by grep + review

| File | Required change |
|------|-----------------|
| `docs/architecture.md` | Rewrite: subagent-driven framework (4 tools, state.py state machine, 3 hooks, phase chains); remove pipeline flow/phase table |
| `docs/project-structure.md` | New module layout (`state.py`, `tools.py`, `hooks.py`, `prompts/`), 5 skills, test layout without `tests/evals/` |
| `docs/workflows.md` | Replace "Running the Full Pipeline" with tool recipes (plan → execute → simplify → review); updated test commands; version workflow |
| `docs/conventions.md` | Plugin Pattern section (tools/hooks/state); Skill Conventions (5 skills, no verb-form pipeline); Testing table (evals removed) |
| `docs/testing.md` | Remove eval-harness section; point to Phase 7 Docker E2E as behavioral gate |
| `docs/tech-stack.md` | Drop/replace `SkillEvalHarness` references |
| `docs/README.md` | Summary (5 skills, 4 tools); fix anchors referencing the skill-driven pipeline |
| `docs/modules/plugin-entry.md` | register() flow with 4 tools + 3 hooks; skill table → 5 rows; module boundaries updated |
| `README.md` (root) | Summary, usage (tools + CLI), architecture blurb |
| `AGENTS.md` | Architecture section → subagent-driven; skills 13 → 5; test count 39 → 35 |
| `pyproject.toml` | `version = "1.0.0"`, description updated (no "pipeline skills") |
| `src/jovaltus/plugin.yaml` | `version: 1.0.0`, description updated |
| `CHANGELOG.md` | New `## v1.0.0` entry (Keep a Changelog) summarizing the refactor |

Verification commands:

```
grep -rn -iE "skill-driven|discuss|to-spec|to-tasks|13 bundled|13 skills|9 pipeline" README.md AGENTS.md docs/   # must exit 1 (no matches); CHANGELOG.md exempt (history)
grep -n "^version" pyproject.toml src/jovaltus/plugin.yaml   # both 1.0.0
```

`docs/setup.md` requires no change (no pipeline references) — untouched.

## 7. Behavior preservation

- `tests/test_git_utils.py` (19) and `tests/test_sync.py` (8): unmodified, green.
- `tests/integration/test_cli.py` (8): unmodified; Docker-harness tests behave exactly as at baseline (green when Docker available, same skip behavior otherwise).
- No new dependencies: `pyproject.toml` `[project] dependencies` and `uv.lock` unchanged (only `version`/`description` in pyproject).
- Runtime deployment stays on the release flow: user runs `hermes jovaltus update` post-release — **no manual runtime skill sync during development**.

## 8. Phase 7 — Docker E2E verification (REQUIRED final gate; orchestrator runs this)

After T1–T4 pass locally, run this exact recipe (from requirements.md; per hermes-plugin-testing iterate-fix-restart loop):

1. **Temp HERMES_HOME:**
   ```bash
   TMP=$(mktemp -d) && mkdir -p "$TMP/.hermes"
   cp ~/.hermes/config.yaml "$TMP/.hermes/config.yaml"     # or default-profile config
   cp ~/.hermes/.env "$TMP/.hermes/.env"                   # provider credentials
   ```
2. **Derived image** (base pins uv `exclude-newer`; relax it + install fabricium):
   ```dockerfile
   FROM <hermes-agent-base-image>
   ENV UV_EXCLUDE_NEWER=2099-01-01
   RUN uv pip install --python /opt/hermes/.venv/bin/python fabricium
   ```
   Build with `docker build -t jovaltus-e2e -f - .` (or `docker commit` after an interactive fix loop — do NOT use one-shot `--rm` per command).
3. **Long-running container:**
   ```bash
   docker run -d --name jovaltus-e2e -v "$TMP/.hermes:/opt/data" -e HERMES_HOME=/opt/data jovaltus-e2e sleep infinity
   ```
4. **Install the plugin inside the container:** pip entry point, or copy the repo into `/opt/data/plugins/` and run `docker exec jovaltus-e2e hermes plugins enable jovaltus` (fabricium must be importable — step 2 covers it).
5. **Verify agent behaviour** (`docker exec jovaltus-e2e hermes chat -q "<prompt>"`):
   - `hermes plugins list` → `jovaltus` enabled.
   - `hermes jovaltus status` → exit 0.
   - Prompt that triggers a plugin tool, e.g. `docker exec jovaltus-e2e hermes chat -q "call the plan tool with user_requirements='build a hello world CLI'"` → **exit code 0, no plugin traceback**. Assert on side effects + exit code, NOT exact LLM text (non-deterministic output):
     - plan tool spawns a subagent: `subagent_start`/`subagent_stop` hook fires (visible in agent.log / tool-call traces);
     - state file written: `/opt/data/jovaltus_state.json` exists and contains a `"pipeline"` key with `tool=plan`;
     - `pre_llm_call` injection: pipeline status visible in a follow-up turn's context or agent.log.
   - Container agent uses the copied config/.env → same OpenAI-compatible provider as the local session (resolve profile-specific paths to the default profile's config/.env if needed).
6. **Cleanup (user expects test resources gone when verification passes):**
   ```bash
   docker rm -f jovaltus-e2e
   docker rmi jovaltus-e2e
   rm -rf "$TMP"
   docker builder prune -a -f    # keep the base image
   ```
7. **Gate:** all assertions in step 5 pass → refactor accepted. Any failure → fix in the main tree and re-run the loop.

## 9. Scope guards

**May change (whitelist):**
- `src/jovaltus/__init__.py`, `src/jovaltus/state.py`, `src/jovaltus/tools.py`, `src/jovaltus/hooks.py`, `src/jovaltus/prompts/` (new)
- `src/jovaltus/plugin.yaml`, `src/jovaltus/skills/qa/SKILL.md`, `src/jovaltus/skills/project-documentation/templates/architecture.md.tmpl`
- Deletions: 8 pipeline skill dirs (`jovaltus`, `discuss`, `design`, `to-spec`, `to-tasks`, `execute`, `simplify`, `review`), `tests/evals/` (whole dir)
- `tests/test_state.py`, `tests/test_tools.py`, `tests/test_hooks.py`, `tests/test_register.py` (new)
- `docs/*` (8 files listed in §6), `README.md`, `AGENTS.md`, `CHANGELOG.md`, `pyproject.toml` (version + description only)

**May NOT change (hard guard):**
- `src/jovaltus/SOUL.md`; the 4 kept utility skill dirs (`agentic-debugging`, `manage-agents-md`, `manage-git-repo`, `project-documentation`) — byte-identical
- `tests/test_git_utils.py`, `tests/test_sync.py`, `tests/integration/*`, `tests/conftest.py`
- `uv.lock`, `.pre-commit-config.yaml`, `.gitignore`
- fabricium itself, Hermes core (`hermes_cli/`, `tools/`), any file outside this repo
- `.plan/07-08-2026/jovaltus-subagent-architecture/` (this plan — READ-ONLY)

**Out of scope:** new dependencies; new Hermes core features; changes to git_utils/sync/Docker CLI harness unless the tool/hook additions break them (they must not); `git tag`/PyPI release (orchestrator post-gate step via manage-git-repo Workflow B).

## 10. Version and release note

- Version bump: `0.14.2` → **`1.0.0`** (breaking-change semver bump; `v0.7.0` would downgrade below the current release and break pip/PyPI ordering — the requirements' "v0.7" is the milestone name, not the release number).
- Release flow (after Phase 7 passes): bump is already in the tree (T4) → tag `v1.0.0` → push tags (PyPI trusted publisher) → user runs `hermes jovaltus update`.

## 11. Sign-off checklist (orchestrator)

- [ ] §1 all four check commands green (35 tests)
- [ ] §2 registration tests pass; §3 state-machine tests pass (incl. resume); §4 hook/determinism tests pass
- [ ] §5 exactly 5 skills; qa rewritten; evals deleted; §6 grep clean; §7 preserved suites green
- [ ] §8 Phase 7 Docker E2E passes with cleanup executed
- [ ] §9 scope guards respected (`git diff --stat` against whitelist only)
