---
name: to-environment
description: >
  Create isolated git worktrees for each task in the manifest. Each
  worktree contains only what the subagent needs: relevant source code,
  related project documentation (for architectural context), and the
  task file. Everything else is excluded via sparse-checkout.
  Use when: setup worktrees, create environments, to-environment,
  建立環境, 創建worktree, 設置隔離環境, 準備開發環境.
  NOT for: creating tasks or specs (use to-spec/to-tasks), running
  subagents (this only creates environments), single-branch work.
author: LaiTszKin
version: 0.3.0
metadata:
  jovaltus:
    tags: [worktree, environment, isolation, parallel, sparse-checkout]
---

# To Environment

## Goal

Create one isolated git worktree per task. Each worktree is the subagent's
entire world: source code it touches, project docs that explain those files,
and the task file. Unrelated code and docs are excluded.

## Acceptance Criteria

- One worktree per task on branch `agent/<id>-<slug>`
- Sparse-checkout includes only: CREATE/EDIT source files, related project
  docs, and config needed for the verification command
- Unrelated source code and unrelated project docs excluded
- Zero file-write conflicts (disjoint file ownership)
- Each worktree self-contained: `TASK.md` + code context from docs + runnable
  verification

## Core Principles

**What the subagent needs, nothing else.** Three things go in: (1) the task
file, (2) source code the task touches (CREATE/EDIT + blast-radius dependents),
(3) project docs that explain those source files. Nothing else.

**Docs give context, not noise.** A subagent with only `TASK.md` reinvents
architecture. A subagent with every doc in `docs/` drowns. Map docs to
source files — include only what explains the files the task touches.

**One branch per task.** `agent/<id>-<slug>`. Clean commits, trivial review,
clean teardown.

## Workflow

### Phase 1: Read All Task Files

Read every task from the manifest. Extract per task: ID, slug, description,
CREATE list, EDIT list, READ list, verification command.

### Phase 2: Map Source ↔ Task Relationships

For each task, determine which source files are relevant:

1. **CREATE**: parent directories of all new files
2. **EDIT**: exact paths of modified files
3. **Blast radius (brownfield only)**: for each EDIT file, find all files
   that import it transitively. Exclude generated files, vendor deps, and
   unrelated files. Skip for greenfield (no EDITs).
4. **Config**: `pyproject.toml`, `package.json`, `conftest.py` — whatever
   the verification command needs.

### Phase 3: Identify Project Documentation

For each task's source files, find project docs that give subagents context:

1. Scan for: `docs/`, `README.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`,
   `AGENTS.md`, `CLAUDE.md`, `.cursorrules`
2. Map docs to source files — use ripgrep to find docs mentioning each
   module the task touches
3. Filter by relevance: auth docs for auth task, not payment task
4. Always include: `AGENTS.md`/`CLAUDE.md` (conventions apply to all tasks)

### Phase 4: Build Sparse-Checkout Sets

For each task, assemble the directory set:

```
Task <id>-<slug>
├── TASK.md               (copied from manifest)
├── Source code            (Phase 2: CREATE dirs + EDIT files + blast radius)
├── Config                 (Phase 2: pyproject.toml, conftest.py, etc.)
└── Project docs           (Phase 3: relevant docs only)
```

Validate: no cross-task source leakage, no unrelated docs, verification
command can run.

### Phase 5: Create Worktrees

For each task: create worktree on branch `agent/<id>-<slug>`, enable
cone-mode sparse-checkout with the Phase 4 directory set, copy task file
to `TASK.md`. See `assets/worktree-config.md` for exact syntax.

### Phase 6: Validate

Smoke test each worktree: `TASK.md` present, source files accessible, docs
present, config present, no cross-task leakage. Present summary table: task
ID, slug, branch, file count, verification status.

## Gotchas

- **Documentation relevance is load-bearing.** Missing `ARCHITECTURE.md` =
  subagent reinvents patterns. All 50 docs = subagent drowns. Be surgical.
- **AGENTS.md / CLAUDE.md / .cursorrules apply to all tasks.** Include them
  in every worktree regardless of which source files the task touches.
- **Cone mode only accepts directories.** For single-file needs in large
  directories, include the parent directory.
- **Worktree cleanup after subagents finish:** `git worktree remove` then
  `git worktree prune`. Use `--force` only when worktree holds stale locks.
- **Branch names must be unique.** `agent/1-t1-auth`, `agent/1-t2-payment`.
  Never reuse names in the same wave.
- **Config files enable verification.** If `pytest` needs `pyproject.toml`
  or `conftest.py`, include them — not the whole project config surface.

## References

- `assets/worktree-config.md` — Git worktree + sparse-checkout syntax, blast
  radius discovery patterns (Python and JS/TS). Load for exact commands.
