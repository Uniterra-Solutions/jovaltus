# Changelog

All notable changes to the **Jovaltus** Hermes plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
