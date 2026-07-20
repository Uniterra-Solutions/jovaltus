---
name: to-environment
description: >
  Creates isolated git worktrees for each task in the manifest with
  sparse-checkout scoped to only the files that task needs. For brownfield
  projects, performs blast-radius analysis to include affected files.
  Each worktree is a self-contained environment ready for subagent execution.
  Produces worktrees under .worktrees/.
  LOAD when:
  - Task manifest exists at .plan/<date>/<name>/tasks/manifest.md
  - User says "setup worktrees" or "create environments" or "to-environment"
  - Ready to spawn parallel subagents from the task manifest
  Do NOT use for:
  - Creating tasks or specs (use to-spec, to-tasks)
  - Running subagents — this only creates the environments
  - Single-branch sequential work
author: LaiTszKin
version: 0.1.1
metadata:
  jovaltus:
    tags: [worktree, environment, isolation, parallel, sparse-checkout]
---

# To Environment

## Goal

Create one isolated git worktree per task. Each worktree contains only the
files that task needs — zero unrelated noise. For brownfield projects,
blast-radius analysis pulls in every file affected by the planned changes.

## Acceptance Criteria

- One worktree per task, each on its own branch `agent/<id>-<slug>`
- Sparse-checkout scoped to: task files (CREATE/EDIT), blast-radius dependents,
  project config files needed for verification
- Zero file-write conflicts across worktrees (enforced by disjoint file ownership)
- Each worktree is self-contained: subagent can read TASK.md + run verification

## Core Principles

**Minimal surface area.** The worktree contains exactly what the task needs.
This reduces token consumption and prevents accidental edits. Include the
task's CREATE/EDIT files, dependent files (blast radius), and the config
files needed for the verification command.

**Blast radius for brownfield.** When a task edits existing files, find every
file that imports them — transitively. Those dependents may break. Include
them. For greenfield (all CREATE), blast radius is unnecessary.

**One branch per task.** `agent/<id>-<slug>`. Isolates commits, makes review
trivial (one PR per task), enables clean teardown.

## Workflow

### Phase 1: Parse Manifest

Extract task IDs, slugs, file ownership (CREATE/EDIT/READ), verification
commands from `manifest.md`.

### Phase 2: Build File Sets Per Task

For each task, determine what files the sparse-checkout includes:

1. **Always**: the task file (copied as TASK.md), project config needed for
   verification (pyproject.toml, package.json, etc.)
2. **CREATE**: parent directories of all new files
3. **EDIT**: each file's exact path + its dependents (blast radius)
4. **Blast radius (brownfield only)**: for every EDIT file, find all files
   that import it using `rg "from <module> import|import <module>" --files-with-matches`.
   Include transitive dependents and their test files. Exclude generated files
   (dist/, build/), vendor deps, and unrelated files in same directory.
5. **Greenfield shortcut**: if no EDIT files, just include CREATE dirs + config.

### Phase 3: Create Worktrees

For each task: `git worktree add .worktrees/<id>-<slug> -b agent/<id>-<slug>`,
enable cone-mode sparse-checkout with the file set directories. Copy the task
file to `TASK.md` in the worktree root. See `assets/worktree-config.md` for
exact git syntax.

### Phase 4: Validate

Smoke test each worktree: TASK.md present, EDIT files exist, config files
present, no files from other same-wave tasks. Present summary to user.

## Gotchas

- **Cone mode only accepts directories.** If you need a single file from a
  large directory, include the parent directory. The token cost of extra files
  is negligible compared to non-cone mode complexity.
- **Worktree cleanup.** After subagents finish: `git worktree remove .worktrees/<dir>`.
  Stale metadata: `git worktree prune`.
- **Branch name uniqueness.** Two tasks get different branches (`agent/1-t1-*`,
  `agent/1-t2-*`). Never reuse names.
- **Config files enable `pytest` / `npm test`.** If the verification command
  needs `pyproject.toml` (pytest config) or `conftest.py`, include them.
- **Blast radius tools are optional.** `rg` with import patterns is sufficient
  for most projects.
- **Don't overthink `.git`.** It's always present in a worktree. Sparse-checkout
  only affects the working tree.

## References

- `assets/worktree-config.md` — Exact git worktree + sparse-checkout syntax.
  Load on demand when creating or managing worktrees.
