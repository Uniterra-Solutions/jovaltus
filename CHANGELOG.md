# Changelog

All notable changes to the **Jovaltus** Hermes plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## v1.1.3 — 2026-08-08

### Fixed
- **Review/simplify loops no longer deadlock on the fixer's iteration
  cap.** Previously a `"fix"` verdict dispatched a fixer *subagent*, which
  shares Hermes's per-subagent iteration budget (hardcoded 50 via
  `subagent_lifecycle`). On large finding sets the fixer was cut off
  mid-fix, the next review re-flagged the same defects, and the loop
  burned tokens without converging (observed 2026-08-08: 16 rounds, all
  iteration-capped, `verdict.json` unchanged). Now a `"fix"` verdict parks
  the pipeline in a `*_waiting` phase and the **main agent performs the
  fixes** — it has no subagent iteration cap and full conversation
  context. When the fixing turn ends, the new `post_llm_call` hook
  re-dispatches the reviewer automatically.

### Changed
- **Phase chains** — `simplify_fix`/`review_fix` are replaced by
  `simplify_waiting`/`review_waiting` (parking phases; no subagent runs).
- **4 hooks** — `post_llm_call` added: re-dispatches the reviewer when the
  pipeline is parked in a `*_waiting` phase and the completed turn belongs
  to the main agent (`platform != "subagent"`); inert outside the loop.
- **Fix-request wake-up** — on a `"fix"` verdict the plugin pushes a
  completion event carrying the reviewer's findings; the per-iteration
  `session_id` keeps the host's dedup key from swallowing later rounds.
- **7 prompts** — `simplify-fix.md` and `review-fix.md` removed (the
  main agent is the fixer; no fixer prompt needed).

---

## v1.1.2 — 2026-08-07

### Fixed
- **Plan artifacts now land in `<session-cwd>/.plan/...`, not `~/.plan`.**
  `_repo_root()` prefers `agent.runtime_cwd.resolve_agent_cwd()` (the
  per-session cwd the desktop pins around every turn), falling back to
  `TERMINAL_CWD` then the process cwd. Previously desktop sessions rooted
  runs at the gateway launch dir (often `~`).
- **The main agent is notified when a pipeline completes.** On a terminal
  state (done or failed), `subagent_stop` pushes a completion event onto
  `process_registry.completion_queue` — the same rail background terminal
  tasks use — so the desktop/CLI/gateway surfaces wake the main agent with
  a "pipeline complete" turn instead of waiting for the user's next
  message. Routing metadata is captured on the first main-turn dispatch.

### Added
- **`hermes jovaltus setup` and `update` auto-configure
  `delegation.max_spawn_depth >= 2`** for installed profiles
  (`setup_config.py`), so `execute` works out of the box. The text-based
  YAML edit preserves every other config key (no yaml dependency).

### Changed
- **`tasks.md` now selects ONE execution form** (batch by default; serial /
  fully-parallel only when the DAG degenerates) instead of writing all
  three serial / batch / fully-parallel sections with duplicate mermaid
  graphs.

## v1.1.1 — 2026-08-07

### Changed
- Tool descriptions now state their USE WHEN scenario so the main agent can
  route requests correctly: `plan` for turning a software-engineering
  request into an implementation plan, `execute` for implementing an
  existing plan, `simplify` for simplifying the plan's implementation,
  `review` for reviewing the plan's implementation.

## v1.1.0 — 2026-08-07

### Added
- All 9 pipeline subagents read the repository before producing their
  artifact: each prompt gains a `[[repo_root]]` input and a Step-0
  instruction to explore AGENTS.md, the project manifest, source layout,
  and tests — PRD/design/acceptance/tasks are grounded in real code,
  reviewers judge diffs in context.

### Changed
- Subagents now inherit the main agent's toolset: `SubagentLaunchRequest`
  leaves `allowed_toolsets` unset so Hermes child construction copies the
  parent's enabled toolsets (delegate_tool.py:1392-1395) instead of a
  fixed terminal/file/web list.

## v1.0.1 — 2026-08-07

### Fixed
- CI release workflow: unit tests no longer import Hermes internals
  ('agent' package absent in the release runner) — request construction
  routed through monkeypatchable _get_launch_request().

## v1.0.0 — 2026-08-07

### Architecture Rewrite

Jovaltus is rearchitected from a **skill-driven pipeline** (13 bundled
skills guiding the orchestrator through each phase) into a
**subagent-driven deterministic framework**: 4 plugin tools dispatch
isolated pipeline subagents, a plugin-owned state machine drives phase
transitions deterministically, and 3 hooks wire subagent lifecycle to the
state machine and inject pipeline status into the main agent's context
every turn.

### Added

- **4 pipeline tools** — `plan` (requires `user_requirements`) and
  `execute` / `simplify` / `review` (each requires `plan`), registered via
  `ctx.register_tool` with `toolset="jovaltus"`, `is_async=False`
  (`src/jovaltus/tools.py`). Handlers return
  `{"status":"started"|"error", ...}` JSON and dispatch the first phase
  via `ctx.dispatch_tool("delegate_task", ...)`.
- **Deterministic state machine** — `src/jovaltus/state.py`:
  `PipelineState` dataclass, `PHASES`/`STATUSES`, and
  `get_pipeline`/`start_pipeline`/`set_phase`/`register_child`/
  `complete_child`/`set_verdict`/`finish_pipeline`/`status_text`/
  `reset_pipeline`. Persisted to `~/.hermes/jovaltus_state.json` under the
  `"pipeline"` key via `fabricium.state` — cross-session resume; the
  fabricium-owned `"profiles"` key is never touched.
- **3 hooks** — `subagent_start` (associates children via the
  `[jovaltus-pipeline:<tool>:<phase>]` goal marker), `subagent_stop`
  (advances the chain; simplify/review read `verdict.json` for
  pass/fix loops with no iteration cap), `pre_llm_call` (injects
  `[Jovaltus pipeline] ...` status each turn) — `src/jovaltus/hooks.py`.
- **Subagent prompt library** — `src/jovaltus/prompts/`: 9 Markdown goal
  documents (prd, research, acceptance, tasks, execute, simplify-review,
  simplify-fix, review, review-fix) with `[[token]]` substitution via
  `str.replace` (never `.format()` — prompt bodies contain mermaid braces).
- **Phase chains** — plan: prd → research → acceptance → tasks → done;
  execute: execute → done; simplify/review: verdict-driven fixer loops.
- **Unit test suites** — `tests/test_state.py` (24), `tests/test_tools.py`
  (18), `tests/test_hooks.py` (17), `tests/test_register.py` (5).
- **Version bump** — `0.14.2` → `1.0.0` (breaking-change semver; a
  `v0.7.x` bump would have downgraded below the current release).

### Changed

- **Bundled skills: 13 → 5.** Deleted the 8 pipeline skill directories
  (`jovaltus`, `discuss`, `design`, `to-spec`, `to-tasks`, `execute`,
  `simplify`, `review`); kept the 4 utility skills (`agentic-debugging`,
  `manage-agents-md`, `manage-git-repo`, `project-documentation`) and
  `qa`.
- **`qa` skill rewritten** as standalone PRD-driven acceptance testing
  (no longer a pipeline phase).
- **`project-documentation` architecture template updated** to describe
  the subagent-driven framework (4 tools + state machine + hooks).
- **Docs updated** — `docs/architecture.md`, `docs/project-structure.md`,
  `docs/workflows.md`, `docs/conventions.md`, `docs/testing.md`,
  `docs/tech-stack.md`, `docs/README.md`, `docs/modules/plugin-entry.md`,
  root `README.md`, and `AGENTS.md` now describe the tool-driven
  framework, 5-skill bundle, and 99-test baseline.
- **`pyproject.toml` / `plugin.yaml`** — version `1.0.0`, descriptions
  updated.

### Removed

- **`tests/evals/`** (conftest.py, tasks.py, rubrics.py,
  test_jovaltus_skills.py — 4 tests). The `SkillEvalHarness` suite
  measured skill lift for the deleted pipeline; its role as the
  behavioral gate is superseded by the Phase 7 Docker E2E verification
  (`docker exec <container> hermes chat -q "<prompt>"`).

## v0.14.2 — 2026-08-03

### Changed

- **`project-documentation` now keeps the root `README.md` in sync.** When
  generating or updating the `docs/` tree, the skill also updates the project
  root `README.md` — linking to the docs hub and reflecting the current stack
  and install/run/test commands. Covered in the goal, acceptance criteria,
  core principles, generation order (new step 12), incremental-update flow,
  gotchas, document-type contract, and audit checklist (coverage, links,
  freshness). The `jovaltus` router's utility reference now describes the
  README sync too.

## v0.14.1 — 2026-08-02

### Changed

- **Subagent dispatch guidance is now intent-based in `execute`, `simplify`,
  and `review` skills.** The skills no longer embed concrete tool
  invocations (`terminal(background=true)`, `process(action='wait')`,
  `delegate_task`, `hermes chat -q`). They instead direct the orchestrator
  to dispatch one subagent per task/worktree — locked to its worktree,
  with brief and verification embedded — leaving the dispatch mechanism to
  the agent. Isolation, parallelism, and timeout constraints are preserved
  as intent, not syntax.
- **Docs and eval rubric updated to match.** `README.md`,
  `docs/architecture.md`, and `docs/modules/plugin-entry.md` describe
  dispatch without tool names; the eval rubric's pipeline-adherence hint
  now counts any subagent dispatch mechanism.

## v0.14.0 — 2026-08-02

### Added

- **`to-tasks` now expresses subagent relationships as a DAG.** The manifest
  (scheduling document) gains a Task DAG section: mermaid diagram, ASCII
  diagram, edge list, and level table. Every task is a node, every
  dependency is a directed edge, and each task gets a topological level
  (`1 + max(dep levels)`). The parallel/batch two-mode framing is replaced
  by one unified model — a zero-edge DAG (all tasks at Level 1) is fully
  parallel; cross-level dependencies are first-class edges, not a fallback.
- **`execute` now dispatches subagents according to the DAG.** Reads the
  manifest's task DAG and runs level-parallel dispatch: all tasks at a level
  spawn simultaneously via `terminal(background=true)` (no concurrency cap);
  levels execute sequentially; each level's branches merge into an
  integration branch so the next level's subagents consume real prior output.
  Failed tasks block their dependents.

### Changed

- **`to-environment` bundled skill removed.** Its worktree creation workflow
  (sparse-checkout isolation, `TASK.md` seeding, blast-radius analysis) is
  absorbed into `execute` Phase 1, with `assets/worktree-config.md` moved to
  the `execute` skill. The pipeline is now
  `discuss → design → to-spec → to-tasks → execute → simplify → review → qa`.
- **Bundled skills: 14 → 13** (9 pipeline + 4 utility). `jovaltus` core
  skill, `README.md`, `AGENTS.md`, and `docs/` updated for the new chain,
  skill count, and DAG execution model.

## v0.13.1 — 2026-07-31

### Changed

- **Skill frontmatter simplified to `name` + `description` only.** All 14
  bundled skills dropped the deprecated `author`, `version`, and `metadata`
  YAML fields per the updated Hermes skill format. Reduced frontmatter noise
  improves agent skill reading.
- **Cantonese normalized to written Chinese in `jovaltus` skill.** Trigger
  phrases and example messages converted (幫我整→幫我做, 唔洗走流程→
  不用走流程, 呢個係→這是, 覆蓋咗需求嘅→已覆蓋需求的, 唔 work→
  不 work, 行為唔啱→行為不對).
- **Docs updated.** Skill count corrected from 11 → 14 in `README.md` and
  `docs/README.md` (pipeline chain now includes `simplify`, utility count
  3 → 4); `docs/workflows.md` frontmatter example updated; `docs/conventions.md`
  frontmatter convention updated; `docs/modules/plugin-entry.md` plugin.yaml
  example version refreshed.

## v0.13.0 — 2026-07-31

### Added

- **`manage-git-repo` Workflow D — Stacked PR.** New workflow for creating
  stacked pull requests via GitHub's native Stacked PRs feature (`gh stack`).
  Triggered when a PR involves multiple commits (4+, or 2–3 distinct layers).
  Each commit becomes its own reviewable PR layer; the whole stack merges in
  one click via `gh stack merge`. Covers extension installation, layer
  classification, cherry-pick distribution, submit, and atomic merge.

### Changed

- **`manage-git-repo` skill bumped to 0.4.0.** Description updated to cover
  stacked PRs; tags now include `stacked-prs`. Skill now covers 4 independent
  workflows: Commit, Version Release, Branch+PR, and Stacked PR.
- **Docs updated.** `docs/workflows.md` gained a recipe for Workflow D (stacked
  PR) alongside Workflow C (single PR). `docs/project-structure.md` updated
  manage-git-repo description.

## v0.12.0 — 2026-07-28

### Added

- **`manage-git-repo` Workflow C — Branch + Batch Commit + PR.** New end-to-end
  workflow that creates a semantic branch from changed files, batch-commits in
  dependency order (docs → refactor → feat/fix → test), and opens a pull request
  via `gh` CLI or curl fallback. Branch names are automatically derived from
  change analysis (`feat/slug`, `fix/slug`, etc.).

### Changed

- **`manage-git-repo` skill bumped to 0.3.0.** Frontmatter updated to reflect
  new PR workflow capability. Skill now covers 3 independent workflows: Commit,
  Version Release, and Branch+PR.
- **Docs updated.** `docs/workflows.md` gained a recipe for Workflow C;
  `docs/project-structure.md` updated manage-git-repo description.

## v0.11.1 — 2026-07-28

### Changed

- **`jovaltus` skill now routes to all 14 bundled skills.** Phase 0 triage
  expanded from two buckets (Direct / Pipeline) to three (Direct / Utility /
  Pipeline). New Bucket 2 covers non-pipeline utility skills: `agentic-debugging`
  (bugs, errors, unexpected behavior), `manage-agents-md` (project convention
  files), `project-documentation` (docs/ tree generation), and `manage-git-repo`
  (commit, release, version management).
- **Pipeline flow updated in docs.** `docs/architecture.md`,
  `docs/project-structure.md`, and `docs/workflows.md` now reflect the full
  14-skill pipeline: `jovaltus` (core router) → `simplify` phase, plus
  expanded phase reference tables.

---

## v0.11.0 — 2026-07-28

### Added

- **`to-tasks` two-mode task decomposition.** Fully Parallel mode (default)
  keeps existing disjoint-file behavior. Batch Execution mode (fallback)
  groups tasks into sequential batches when genuine cross-task dependencies
  cannot be eliminated via merging, restructuring, or lazy registration.
  New Phase 0 assesses mode before building the file ownership map.
- **`execute` batch dispatch with inter-batch merge.** Batch loop: rebase
  worktrees onto integration branch → dispatch batch tasks in parallel →
  wait all → merge into integration → next batch. Failed batch tasks block
  downstream dependents automatically.
- **Manifest template** now supports mode declaration, Batch + Depends On
  columns, cross-batch file overlap documentation, and batch dependency
  graph visualization.

### Changed

- **`to-tasks` Core Principles** softened from hard "no cross-task
  dependencies" to a decision tree: merge → restructure → lazy registration
  → batch mode (last resort).
- **`to-environment` gotcha** added confirming batch mode does not change
  worktree setup.
- **Docs** (`architecture.md`, `workflows.md`, `project-structure.md`)
  updated to reflect parallel + batch execution model.

## v0.10.0 — 2026-07-23

### Added

- **`simplify` Direct Changes mode.** Two-mode architecture: Workflow
  (parallel subagents per worktree, unchanged) and Direct Changes
  (single subagent, main agent provides change scope + original requirements
  + implementation plan for simple post-change cleanup). Shared principles
  extracted to top for both modes.
- **`review` Direct Changes mode.** Same two-mode pattern applied to
  adversarial code review. Direct Changes mode dispatches a single subagent
  with change scope + requirements, applying the full 4-layer adversarial
  checklist to only the changed files.

### Changed

- **`simplify` optimised 44%** — fixed subagent self-containment bug
  (Workflow brief referenced orchestrator-only Shared Principles); removed
  pedagogical explanations of concepts frontier models already know;
  compressed subagent briefs to trigger-word checklists with risk tags.
- **`review` optimised 54%** — compressed 4-layer adversarial checklist
  from ~150 lines of textbook to actionable trigger bullets in subagent
  briefs; removed Mode Selection table (redundant with description triggers).

## v0.9.3 — 2026-07-23

### Fixed

- **`manage-git-repo` SKILL.md YAML frontmatter parsing bug.**
  Added explicit blank line between multiline `description` and `author`
  fields — without it, the parser incorrectly merges the two into a single
  malformed value.

## v0.9.2 — 2026-07-23

### Changed

- **`review` skill optimized for token efficiency and correctness.**
  Fixed critical subagent self-containment bug — the 4-layer adversarial
  checklist is now embedded via `cat references/review-checklist.md` instead
  of directing the subagent to load a file it cannot access. Description
  rewritten as user-facing action statement with Chinese trigger keywords
  (代碼審查, 檢查代碼). Merge workflow moved to reference file. 37% token
  reduction.

- **`to-environment` skill optimized with project documentation awareness.**
  Added Phase 3: Identify Project Documentation — maps project docs to source
  files per task so subagents receive architectural context without noise.
  Description expanded with Chinese trigger keywords (建立環境, 創建worktree).
  Removed verbose model-knows commands. 37% token reduction.

## v0.9.1 — 2026-07-23

### Fixed

- **`jovaltus` skill trigger coverage.** The skill's frontmatter description
  previously excluded bug fixes and trivial changes (`NOT for: bug fixes or
  debugging, trivial single-function changes`), causing the agent to skip the
  skill for tasks that should have gone through the pipeline. Replaced with a
  universal trigger ("always load first") and added **Phase 0: Triage** — an
  explicit Direct-vs-Pipeline checklist that routes trivial changes straight
  to implementation while everything else enters the pipeline. The model no
  longer guesses what's "trivial"; the skill decides.

## v0.9.0 — 2026-07-23

### Changed

- **Removed all dependency language from `to-spec` and `to-tasks` skills.**
  The pipeline now enforces **logical independence**: every task is a closed
  system that owns everything it imports, verifies in complete isolation, and
  never references another task's output. Removed: spec dependency
  classification, interface contracts (both directions), dependency graph,
  contract map, cross-task import workarounds (stubs, sequential waves, lazy
  registration). Added explicit independence gating: if a subagent thinks
  "Task B needs X from Task A", the split is automatically wrong — merge them.

## v0.8.2 — 2026-07-22

### Changed

- **Optimized skill frontmatter descriptions** for better trigger coverage:
  `agentic-debugging` (broader bug/error/crash triggers), `jovaltus` (all
  non-trivial SE tasks), `manage-agents-md` (all agent spec files, not just
  AGENTS.md), `manage-git-repo` (added git action keywords), and
  `project-documentation` (added documentation trigger keywords).

## v0.8.1 — 2026-07-21

### Changed

- **`to-tasks` skill v0.3.0 — complete vertical slice decomposition**: each task
  now bundles its own implementation + tests + full referenced code context
  (zero external lookups needed). Tests ALWAYS travel with implementation
  (hard rule, never split). READ files get full content inlined, not just
  file paths. Tasks intentionally larger (30-60 min) to eliminate cross-worktree
  coordination. Specs → tasks is condensation, not 1:1 mapping. Added "Owns
  Tests" column to manifest and "Referenced Code" section to task template.

## v0.8.0 — 2026-07-21

### Added

- **`jovaltus` core skill** (pipeline, entry-point): defines the full 10-phase
  Jovaltus software development pipeline and smart entry-point routing. Agent
  analyzes user prompt maturity to skip completed phases — vague idea →
  `discuss`, complete requirements → write PRD → `design`, requirements +
  technical plan → write PRD + design.md → `to-spec`. Later phases run
  sequentially.

### Changed

- **Skill optimization**: compressed `manage-git-repo` and `simplify` skill
  frontmatter descriptions for token efficiency (-47% bytes each).
- Bundled skills: 13 → 14 (10 pipeline + 4 utility)

## v0.7.0 — 2026-07-21

### Added

- **`manage-git-repo` skill** (utility): guides agents through two independent
  workflows — structured git commits grouped by change category, and semantic
  version releases with automatic version-reference updates, changelog
  maintenance, and annotated tag creation.

- **`simplify` skill** (pipeline, post-execute): dispatches simplification
  subagents into all executed worktrees in parallel. Three risk tiers (SAFE /
  CAREFUL / RISKY) with behaviour preservation as the inviolable rule. Runs
  after execute, before review.

### Changed

- Bundled skills: 12 → 13 (9 pipeline + 4 utility)

## v0.6.0 — 2026-07-20

### Architecture Rewrite

Jovaltus has been rearchitected from a stateful pipeline engine to a **skill-driven
Direct Delegate Pattern**. The plugin no longer runs subagents through tool handlers;
instead, it bundles agent skills that guide the orchestrator (you or another agent)
through each phase. This eliminates ~1,700 lines of state machine, tool handler,
and schema code, replacing them with 8 self-contained, independently loadable skills.

### Added

- **8 pipeline skills** (`discuss` → `design` → `to-spec` → `to-tasks` →
  `to-environment` → `execute` → `review` → `qa`):
  - `discuss`: Interactive requirements elicitation, produces PRD
  - `design`: Dialectical technical design, produces design.md
  - `to-spec`: PRD + design → agent-executable implementation specs
  - `to-tasks`: Flat task decomposition with inlined interface contracts
  - `to-environment`: Isolated git worktrees via sparse-checkout
  - `execute`: Parallel subagent dispatch into worktrees
  - `review`: Adversarial 4-layer code review (assumption violation, composition
    failure, path enumeration, cascade construction). Research-backed methodology
    from Refute-or-Promote, Systematic, BMAD Edge Case Hunter — targets 90%+ catch rate.
  - `qa`: PRD-driven acceptance testing across all app types (web, CLI, API,
    desktop, library). Autonomous fix loop with evidence tests.

- **`review` skill — adversarial review**:
  - 4-layer checklist calibrates depth by risk signal (auth/payment → deep cascade)
  - CI gaming detection (removed tests, lowered coverage)
  - Evidence test protocol: every fix demands test that fails before, passes after
  - Cross-model review recommendation (implement Claude / review Gemini)

- **`qa` skill — PRD-driven acceptance testing**:
  - Auto-detects app type from PRD + design
  - Journeys, not unit tests — exercises complete user flows end to end
  - Fix loop: find → fix → regression test → re-run → iterate
  - Escalation mechanism for unfixable issues (design flaw, missing infra)

- **`execute` skill — parallel subagent dispatch**:
  - Flat parallel: all tasks run simultaneously (3-5 concurrent sweet spot)
  - `terminal(workdir=..., background=true)` for filesystem isolation
  - Process tracking + manifest status table updates

- **`to-environment` skill — git worktree isolation**:
  - Sparse-checkout cone mode per task
  - Blast-radius analysis for brownfield projects

- **`to-tasks` skill — flat task decomposition**:
  - Interface contract inlining eliminates cross-task runtime dependencies
  - File ownership map guarantees zero merge conflicts

### Removed

- **Plugin tools**: `jovaltus_implement`, `jovaltus_verify`, `jovaltus_simplify`
  (stateful + commit-based modes) — replaced by agent skills
- **State machine**: `state.py` (thread-safe in-memory task state, stage tracking)
- **Hook layer**: `hooks.py` (plugin lifecycle hooks)
- **Schema definitions**: `schemas.py` (tool JSON schemas)
- **`jovaltus-agent` skill** and 3 subagent prompts (`implement.md`, `verify.md`,
  `simplify.md`) — replaced by the 8 pipeline skills
- ~1,700 lines of dead code removed

### Changed

- **`optimise-skill` sweep**: all 8 pipeline skills audited and rewritten for
  clarity, token efficiency, and progressive disclosure (1,953L → 1,022L, -47.7%)
- **Pipeline flattened**: removed wave concept — all tasks execute in parallel
  because file ownership is proven disjoint
- **Skill naming**: all verb-form (`discuss`, `design`, `to-spec`, etc.)
- **Plugin.yaml** simplified: removed `provides_tools` section

---

## v0.5.3 — 2026-07-16

### Fixed

- **Self-bootstrap fabricium on import**: plugin now `pip install fabricium`
  automatically if missing at import time, avoiding `ModuleNotFoundError`

---

## v0.5.2 — 2026-07-16

### Changed

- **Fabricium auto-upgrade on plugin update**: `hermes jovaltus update` now
  upgrades the minimum required `fabricium` version via pip

---

## v0.5.1 — 2026-07-15

### Added

- **3 bundled agent skills**: `project-documentation`, `manage-agents-md`,
  `agentic-debugging` — general-purpose skills available to any Hermes profile
- **CI release workflow**: PyPI trusted-publisher pipeline with ruff + mypy gates

### Changed

- **Fabricium integration**: replaced ~695 lines of boilerplate (plugin scaffolding,
  git utilities, CLI argument parsing) with `fabricium.HermesPlugin` base class.
  Plugin now requires `fabricium>=0.1.1`.
- **Package structure**: pip entry point + src layout. Flat layout removed —
  `packages = ["."]` broke editable installs.

---

## v0.4.0 — 2026-07-14

### Added

- **Pre-commit hooks**: ruff check (lint) → mypy --strict (type) → ruff format
  enforced on every commit
- **Commit-based mode**: `jovaltus_verify(before=<hash>)` and
  `jovaltus_simplify(before=<hash>)` — operates on any commit range without
  pipeline state
- **Plan parameter**: `jovaltus_implement(plan=<file>)` accepts external plan
  files for non-standard workflows
- **Comprehensive CLI help**: `hermes jovaltus -h` with phase-by-phase documentation
- **`optimise-skill` bundled**: agent skill auditing and rewriting framework

### Changed

- **Verify agent**: upgraded to three-layer protocol with computer-use integration
- **Plugin distribution**: pure pip entry point (no more `hermes plugins install`
  from local path required — install from PyPI)

---

## v0.3.2 — 2026-07-11

### Changed

- **Architecture**: plugin CLI commands registered from the default profile
  instead of requiring a dedicated profile — `hermes jovaltus setup/status/update`
  work from any terminal after `hermes plugins install`
- **`setup` flow simplified**: removed `_link_plugin_to_profile()`

---

## v0.3.1 — 2026-07-11

### Added

- **Auto-link plugin to profile on `setup`**: detects installed plugin and ensures
  accessibility from `jovaltus-agent` profile
- **Better error message on `setup`**: suggests installing from outside the repo

---

## v0.3.0 — 2026-07-11

### Added

- **State management** (`~/.hermes/jovaltus_state.json`): tracks installation
  mode and timestamps per profile
- **CLI: `status`**: shows installation status for jovaltus-agent profile
- **Interactive prompts**: TTY-aware yes/no with defaults
- **Profile sync on `update`**: refreshes SOUL.md and timestamps
- **Stale skill detection**: compares installed vs bundled skills, removes orphans
- **TypedDict return types** in `git_utils.py`

---

## v0.2.0 — 2026-07-09

### Added

- Profile + SOUL.md setup via `hermes jovaltus setup`
- Update checking via `hermes jovaltus update`
- Git utilities for remote operations (fetch, pull, ahead/behind)
- Bundled skill registration

---

## v0.1.0 — 2026-07-09

Initial release. Jovaltus Agent Mode — automated development pipeline
(Plan → Implement → Verify → Simplify) as a Hermes plugin.
