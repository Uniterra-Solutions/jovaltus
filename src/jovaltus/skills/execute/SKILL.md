---
name: execute
description: >
  Dispatches subagents according to the manifest's task DAG. Reads the DAG
  (nodes = tasks, directed edges = dependencies, levels = topological
  layers), creates one isolated sparse-checkout worktree per task, then runs
  level-parallel dispatch: all tasks at a level spawn simultaneously;
  levels execute sequentially; each level's
  branches merge into an integration branch so the next level's subagents
  see real prior output. Failed tasks block their dependents. Updates
  manifest execution status. Reports pass/fail per task.

  LOAD when:
  - A manifest with a task DAG exists (under .plan/.../tasks/manifest.md)
  - User says "execute" or "run the tasks" or "dispatch" or "執行" or
    "派出subagent"
  Do NOT use for:
  - Creating tasks (use to-tasks)
  - Running a single task manually
  - Tasks without a manifest + DAG
---

# Execute

## Goal

Dispatch subagents according to the task DAG in the manifest. The DAG is the
schedule: same-level tasks run in parallel, levels run sequentially in
topological order, and each level's output is merged into an integration
branch so the next level's subagents consume real interfaces — not stubs.

This skill also creates the worktree environments (absorbing the former
`to-environment` phase): one isolated sparse-checkout worktree per task,
seeded with its TASK.md, config, and relevant project docs.

## The Dispatch Model

- **Level 1** tasks have no dependencies — dispatched immediately, in
  parallel, from the base repo.
- **Level N** tasks depend on Level 1..N-1 output. Their worktrees are
  rebased onto the integration branch (which has accumulated all prior
  levels' merged branches) before their subagents start.
- **Within a level**: full parallel dispatch — all tasks spawn at once,
  no concurrency cap.
- **A failed task blocks its dependents** — downstream levels wait; the
  orchestrator asks retry / skip / halt before proceeding.

## Acceptance Criteria

- Every manifest task is dispatched, in topological order
- All tasks at the same level run simultaneously, each subagent isolated
  to its own worktree
- Level N worktrees contain Level 1..N-1 output (integration branch) before
  their subagents start
- Each subagent locked to its worktree — cannot escape to parent
- Failed tasks identified + reported; orchestrator asks: retry, skip, halt
- Manifest status table updated as tasks complete

## Core Principles

**The DAG is the schedule.** Parse the manifest's DAG, verify acyclicity,
read (or recompute) the levels. Dispatch is level by level: parallel within,
sequential across. Never dispatch a task before its dependencies pass.

**Dispatch a subagent per task, rooted in its worktree.** Each subagent's
working directory IS its worktree — it sees only that project and cannot
escape to the parent repo. Choose whatever dispatch mechanism guarantees
this isolation (e.g. launch the subagent with the worktree as its working
directory). The subagent's final reply is its report.

**No concurrency cap within a level.** Dispatch ALL tasks at the current
level in one batch — don't stagger, don't create waves.

**Worktree is the isolation boundary.** The subagent sees only files in its
worktree. Same-level siblings cannot conflict because file ownership is
disjoint by construction; cross-level files appear via the integration
branch rebase.

**Inter-level merge is the handoff.** The ONLY cross-level coordination is
the merge step between levels. After level N completes, merge its branches
into the integration branch, then rebase level N+1 worktrees onto it.

**Environment creation is part of execute.** The separate `to-environment`
phase no longer exists. One sparse-checkout worktree per task, on branch
`agent/<id>-<slug>`, containing only what the subagent needs: CREATE/EDIT
source files, config for the verification command, relevant project docs,
and TASK.md. See `assets/worktree-config.md` for exact commands.

## Prerequisites

1. Manifest at `.plan/<DD-MM-YYYY>/<name>/tasks/manifest.md` — declares the
   task DAG (nodes, edges, levels)
2. `hermes` CLI in PATH
3. `git` CLI available for worktree creation + inter-level merges

## Workflow

### Phase 0: Read Manifest + Parse DAG

Read the manifest. Extract: task inventory (id, slug, level, depends on,
verification command, worktree path, branch), the edge list, and the file
ownership map.

Validate:
- DAG is acyclic
- Level assignment matches the edges (every edge points to a higher level)
- Zero file ownership overlaps within each level

Any check fails → stop; the manifest is broken. Tell the user to re-run
`to-tasks`.

### Phase 1: Create Environments (worktrees)

For every task, create its worktree:

1. `git worktree add .worktrees/<id>-<slug> -b agent/<id>-<slug>` — use
   `--no-checkout` + sparse-checkout so only the task's files are present
2. Sparse-checkout includes: CREATE/EDIT source files, config the
   verification command needs (pyproject.toml / package.json / conftest.py),
   and project conventions (AGENTS.md / CLAUDE.md). Exclude unrelated code,
   docs, and other tasks' files.
3. Copy the task file to `TASK.md` in the worktree.
4. Install dependencies the verification command needs (`uv sync --all-extras`
   / `pnpm install` etc.). Level ≥ 2 worktrees need a re-sync after the
   integration rebase in Phase 2 Step 1.

See `assets/worktree-config.md` for exact git syntax and blast-radius
discovery patterns.

### Phase 2: Dispatch Loop (per level)

For each level L = 1, 2, ..., N:

---

**Step 1: Rebase level L worktrees (skip L=1)**

Level 1 worktrees already contain the base repo — no rebase needed. For
level L ≥ 2, each worktree needs all prior-level code:

```bash
for worktree in .worktrees/<level-L-task-ids>; do
    cd "$worktree"
    git fetch origin agent/integration-{{plan-slug}}
    git rebase agent/integration-{{plan-slug}}
done
```

This pulls all level 1..L-1 code into level L's worktrees. After rebase,
level L subagents can import and use code from earlier levels.

⚠️ **Rebase conflicts**: if a rebase fails, the level's worktree conflicts
with prior-level output. This should not happen if `to-tasks` validated
ownership per level, but if it does: stop, report the conflict, and let the
user decide whether to resolve manually or re-decompose.

---

**Step 2: Dispatch level L tasks**

All tasks at level L spawn simultaneously — no concurrency cap. For each
task, dispatch one subagent rooted in its worktree
(`.worktrees/<id>-<slug>`). Its brief must say:

- Read `TASK.md` and implement everything specified
- The worktree contains code from earlier levels (merged via the
  integration branch) — build on real interfaces, not stubs
- Work only in this directory; never touch the parent repo
- Run the verification command when done and report the result

Keep a handle per dispatched subagent so you can wait on each one. Mark
level L tasks 🟡 running in manifest.

---

**Step 3: Wait + update status**

Wait for every dispatched subagent at this level to finish. Check exit
codes. Update manifest: 🟢 passed or 🔴 failed.

---

**Step 4: Handle failures**

If any task at level L failed:
- Report which tasks failed and their output
- Ask user: retry (re-dispatch, maybe with modified TASK.md), skip
  (continue with remaining levels anyway — risky, dependents will break),
  or halt (stop pipeline)

If the user chooses to continue after a failure: do NOT merge failed task
branches into the integration branch. Document the skip. **Failed tasks
block dependents** — any later-level task depending on a failed task cannot
proceed; flag this to the user before dispatching the next level.

---

**Step 5: Merge level L into integration**

If all level L tasks passed (or the user chose to skip failed ones):

```bash
git checkout agent/integration-{{plan-slug}}
for task in <level-L-task-ids>; do
    git merge agent/<id>-<slug> --no-ff -m "merge(level-{{L}}): {{task-slug}}"
done
```

If some tasks failed and the user chose to skip them: merge only the passed
task branches. Document which tasks were skipped in the manifest.

⚠️ **Merge conflicts**: merging task branches from the same level should
never conflict (disjoint file ownership within level). If a conflict occurs,
the manifest's ownership validation was wrong — stop and investigate.

---

**Step 6: Next level** — return to Step 1 for level L+1. After the last
level, proceed to Phase 3.

### Phase 3: Final Report

Print per-level summary:
- Level 1: T1 🟢, T2 🟢 (2/2 passed)
- Level 2: T3 🟢, T4 🔴 (1/2 passed)
- ...

Overall: N tasks, K passed, M failed. For failed tasks, include subagent
final output.

### Phase 4: Handle Failures

Same as Phase 2 Step 4 — ask user for each failed task: retry, skip, or
halt.

---

## Gotchas

- **Subagent has no awareness of same-level siblings.** They don't
  coordinate and can't conflict because the file ownership map is disjoint
  within each level.
- **Subagents DO see earlier-level code.** After the rebase step (Phase 2
  Step 1), level L ≥ 2 worktrees contain all prior-level output. Subagents
  implement against real interfaces, not stubs.
- **Dispatch returns immediately.** Keep the handle returned by each
  dispatch and block on it before advancing to the next step.
- **Timeout.** Give each subagent a generous timeout (~30 min); a short
  default can kill long implementations.
- **Subagent model.** Uses same model as parent. For cost savings, dispatch
  with a cheaper model configured.
- **Stale worktrees.** If the manifest was regenerated, remove old worktrees
  (`git worktree remove --force` + `git worktree prune`) before Phase 1.
- **Integration branch is temporary.** `agent/integration-{{plan-slug}}`
  exists only for the duration of dispatch. It can be deleted after all
  levels complete and results are merged into the main branch.
- **Rebase vs merge into worktrees.** Rebase is used (not merge) when
  pulling integration into level N worktrees because it produces a clean
  linear history and avoids merge commits inside task branches. Each task
  branch should contain only that task's commits.
- **Environment setup is part of execute now.** The old `to-environment`
  phase is gone — do not ask the user to "prepare environments" as a
  separate step. Phase 1 handles worktree creation inside this skill.
- **Sparse-checkout minimalism.** Include only what the subagent needs:
  CREATE/EDIT files, config for the verification command, and
  AGENTS.md/CLAUDE.md. Never create full-repo worktrees — they waste
  context. See `assets/worktree-config.md` for cone vs non-cone modes.
- **Interface contracts reduce integration risk, not eliminate it.** Two
  tasks in different levels agreeing on a contract will both pass in
  isolation, but an integration test after merging all levels is still
  recommended.
- **Cleanup is NOT auto.** Execute stops at completion. Merge, worktree
  removal, and branch deletion happen in `review` phase.
- **Failed tasks block downstream.** If T1 at level 1 fails and T3 at level
  2 depends on T1, T3 cannot proceed. Either retry T1 or restructure T3 to
  not depend on T1. The orchestrator should flag this and ask the user
  before dispatching level 2.

## References

- `assets/worktree-config.md` — Git worktree + sparse-checkout syntax, blast
  radius discovery patterns (Python and JS/TS). Load for exact commands.
- `jovaltus-execution-patterns` — runtime skill with non-obvious execution
  pitfalls: subagent commit gotcha, no-concurrency-cap dispatch, uv worktree
  provisioning, subagent timeouts.
