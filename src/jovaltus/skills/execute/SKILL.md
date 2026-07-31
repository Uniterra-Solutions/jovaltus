---
name: execute
description: >
  Dispatches subagents into prepared git worktrees. Two dispatch modes:
  (1) Fully Parallel — all tasks spawn simultaneously (manifest proves
  disjoint file ownership). (2) Batch — sequential batch dispatch with
  inter-batch merges, for tasks with documented cross-batch dependencies.
  Updates manifest execution status. Reports pass/fail per task.

  LOAD when:
  - Worktrees exist under .worktrees/ and manifest exists
  - User says "execute" or "run the tasks" or "dispatch" or "執行"
  - Ready to spawn subagents from prepared worktrees
  Do NOT use for:
  - Creating tasks or worktrees (use to-tasks, to-environment)
  - Running a single task manually
  - Tasks without manifest + worktrees already prepared
---

# Execute

## Goal

Dispatch subagents into prepared worktrees. In fully parallel mode, all
tasks run simultaneously — safe because the manifest proves disjoint file
ownership. In batch mode, tasks within a batch run in parallel; batches
execute sequentially with inter-batch merges so later batches consume
earlier batches' output.

## Two Modes

### Mode 1: Fully Parallel (Default)

All tasks dispatched at once. The file ownership map proves zero shared
write targets — parallel execution is safe by construction. All tasks
start simultaneously; results collected as they complete.

### Mode 2: Batch Execution

Tasks dispatched in sequential batches. Within each batch, tasks are
parallel-safe (disjoint files). Between batches, later batches depend
on earlier batches' output.

**Batch dispatch loop:**
1. Dispatch all tasks in Batch N in parallel
2. Wait for all Batch N tasks to complete
3. If all passed: merge Batch N branches into an integration branch,
   then rebase Batch N+1 worktrees onto the integration branch
4. Dispatch Batch N+1
5. Repeat until all batches done

## Acceptance Criteria

- Every manifest task is dispatched
- **Fully parallel**: All run simultaneously via `terminal(background=true, workdir=<path>)`
- **Batch**: Tasks within each batch run in parallel; batches run sequentially
- **Batch**: Inter-batch merges applied — batch N+1 worktrees contain
  batch 1..N code before their subagents start
- Each subagent locked to its worktree — cannot escape to parent
- Failed tasks identified + reported; orchestrator asks: retry, skip, halt
- Manifest status table updated as tasks complete

## Core Principles

**Flat parallel dispatch (same batch).** Within a batch, all tasks start
at once. The file ownership map proves zero shared write targets within
the batch — parallel execution is safe by construction.

**hermes chat -q, not delegate_task.** `delegate_task` doesn't support
per-subagent workdir. `terminal(workdir=<path>, background=true)` isolates
each subagent to its worktree. Trade-off: losing `delegate_task`'s inline
summary, but the subagent's final reply serves the same purpose.

**3-5 concurrent is the sweet spot.** More than 5 risks API rate limits,
context pressure, and disk I/O contention. In batch mode, this applies
per-batch — batch 1 with 3 tasks + batch 2 with 3 tasks = 6 total across
two sequential waves.

**Worktree is the isolation boundary.** The subagent sees only files in
its worktree. No coordination with siblings — impossible within the same
batch because file ownership is disjoint by construction.

**Inter-batch merge is the handoff.** The ONLY cross-batch coordination is
the merge step between batches. After batch N completes, merge its branches
into a shared integration branch, then rebase batch N+1 worktrees onto it.
Batch N+1 subagents then have all prior-batch code available.

## Prerequisites

1. Manifest at `.plan/<DD-MM-YYYY>/<name>/tasks/manifest.md` — must
   declare mode (`parallel` or `batch`)
2. Worktrees at `.worktrees/<id>-<slug>/` with `TASK.md`
3. `hermes` CLI in PATH
4. **Batch mode only**: `git` CLI available for inter-batch merges

## Workflow

### Phase 0: Read Manifest + Determine Mode

Read the manifest. Extract: mode declaration, task inventory, batch
groupings (if batch mode), file ownership map.

**Fully parallel**: proceed to Phase 1 (Dispatch All).
**Batch**: proceed to Phase B1 (Batch Dispatch Loop).

---

### Fully Parallel Workflow

#### Phase 1: Verify Manifest

Confirm file ownership map has zero overlaps. If any file has two owners
→ stop; manifest is broken. Tell the user to re-run `to-tasks`.

#### Phase 2: Dispatch All Tasks

For every task, spawn simultaneously:

```bash
terminal(
    command="hermes chat -q 'Read TASK.md. Implement everything specified.
Work only in this directory. Run the verification command when done.'",
    workdir=".worktrees/<id>-<slug>",
    background=true,
    notify_on_complete=true,
    timeout=1800
)
```

Collect session_id per task. Mark all 🟡 running in manifest.

#### Phase 3: Collect Results

For each process: `process(action='wait', session_id=<id>)`. Check exit
code: 0 → 🟢 passed, non-zero → 🔴 failed. Update manifest status.

#### Phase 4: Report

Print summary — task ID, status, file count, test output. For failed
tasks, show subagent final output so user can diagnose.

#### Phase 5: Handle Failures

Ask user: retry (re-dispatch, maybe with modified TASK.md), skip (leave
for manual fix), or halt (stop pipeline).

---

### Batch Execution Workflow

#### Phase B0: Verify Manifest

Confirm:
- Mode declared as `batch`
- Batch groupings are non-empty and sequential (1, 2, 3, ...)
- Within each batch, file ownership map has zero overlaps
- Depends On entries reference only tasks in prior batches
- No circular dependencies

If any check fails → stop; manifest is broken.

#### Phase B1: Create Integration Branch

Create an integration branch that will accumulate all batch output:

```bash
git branch agent/integration-{{plan-slug}} HEAD
```

This branch starts at the same base as all task branches. After each
batch completes, its task branches are merged into this integration
branch. The integration branch serves as the rebase target for the
next batch's worktrees.

#### Phase B2: Dispatch Batch Loop

For each batch B = 1, 2, ..., N:

---

**Step 1: Rebase worktrees (skip for batch 1)**

Batch 1 worktrees already contain the base repo — no rebase needed.

For batch B ≥ 2: each worktree needs prior-batch code. Rebase each
batch B worktree onto the integration branch:

```bash
for worktree in .worktrees/<batch-B-task-ids>; do
    cd "$worktree"
    git fetch origin agent/integration-{{plan-slug}}
    git rebase agent/integration-{{plan-slug}}
done
```

This pulls all batch 1..B-1 code into batch B's worktrees. After rebase,
batch B subagents can import and use code from earlier batches.

⚠️ **Rebase conflicts**: If a rebase fails, it means batch B's worktree
has changes that conflict with prior-batch output. This should not happen
if `to-tasks` correctly validated disjoint ownership within each batch,
but if it does: stop, report the conflict, and let the user decide
whether to manually resolve or re-decompose.

---

**Step 2: Dispatch batch B tasks**

Same as fully parallel Phase 2, but only for this batch's tasks:

```bash
for task in <batch-B-task-ids>; do
    terminal(
        command="hermes chat -q 'Read TASK.md. Implement everything specified.
The worktree already contains code from prior batches (merged via git rebase).
Work only in this directory. Run the verification command when done.'",
        workdir=".worktrees/<id>-<slug>",
        background=true,
        notify_on_complete=true,
        timeout=1800
    )
done
```

Collect session_ids. Mark batch B tasks 🟡 running in manifest.

---

**Step 3: Wait for batch B completion**

`process(action='wait', session_id=<id>)` for each task in the batch.
Check exit codes. Update manifest: 🟢 passed or 🔴 failed.

---

**Step 4: Handle batch B failures**

If any task in batch B failed:
- Report which tasks failed and their output
- Ask user: retry failed tasks (re-dispatch within same batch context),
  skip (continue with remaining batches anyway — risky), or halt

If user chooses to continue after a failure: do NOT merge failed task
branches into integration. Only merge passed tasks. Document the skip.

---

**Step 5: Merge batch B into integration (if all passed)**

If all batch B tasks passed:

```bash
git checkout agent/integration-{{plan-slug}}
for task in <batch-B-task-ids>; do
    git merge agent/<id>-<slug> --no-ff -m "merge(batch-{{B}}): {{task-slug}}"
done
```

If some tasks failed and user chose to skip them: merge only the passed
task branches. Document which tasks were skipped in the manifest.

⚠️ **Merge conflicts**: Merging task branches from the same batch should
never conflict (disjoint file ownership within batch). If a conflict
occurs, the manifest's file ownership validation was wrong — stop and
investigate.

---

**Step 6: Next batch**

Return to Step 1 for batch B+1. If this was the last batch, proceed to
Phase B3.

#### Phase B3: Final Report

Print per-batch summary:
- Batch 1: T1 🟢, T2 🟢 (2/2 passed)
- Batch 2: T3 🟢, T4 🔴 (1/2 passed)
- ...

Show overall: N tasks, K passed, M failed. For failed tasks, include
subagent final output.

#### Phase B4: Handle Failures

Same as fully parallel Phase 5 — ask user for each failed task: retry,
skip, or halt.

---

## Gotchas

- **Subagent has no awareness of siblings in the same batch.** They don't
  coordinate and can't conflict because the file ownership map is disjoint
  within each batch.
- **In batch mode, subagents DO see prior-batch code.** After the rebase
  step (B2 Step 1), batch 2+ worktrees contain all prior-batch output.
  Subagents implement against real interfaces, not stubs.
- **Batch mode doubles wall-clock time per batch.** Two batches of 30-min
  tasks = ~60 min minimum (batch 1 → merge → batch 2). Three batches =
  ~90 min. This is why batch mode is a last resort.
- **`terminal(background=true)` returns immediately.** The `session_id`
  is your handle. Use `process(action='wait', session_id=<id>)` to block.
- **Timeout.** Default 180s is too short. Set `timeout=1800` (30 min).
- **Subagent model.** Uses same model as parent. For cost savings, set
  `HERMES_MODEL` to a cheaper model before dispatch.
- **Stale worktrees.** Always run `to-environment` before `execute` if
  manifest was regenerated.
- **Integration branch is temporary.** `agent/integration-{{plan-slug}}`
  exists only for the duration of batch dispatch. It can be deleted after
  all batches complete and results are merged into the main branch.
- **Rebase vs merge into worktrees.** Rebase is used (not merge) when
  pulling integration into batch N worktrees because it produces a clean
  linear history and avoids merge commits inside task branches. Each task
  branch should contain only that task's commits.
- **Interface contracts reduce integration risk, not eliminate it.** Two
  tasks in different batches agreeing on a contract will both pass in
  isolation, but an integration test after merging all batches is still
  recommended.
- **Cleanup is NOT auto.** Execute stops at completion. Merge, worktree
  removal, and branch deletion happen in `review` phase.
- **Failed batch tasks block downstream.** If T1 in batch 1 fails and
  T3 in batch 2 depends on T1, T3 cannot proceed. Either retry T1 or
  restructure T3 to not depend on T1. The orchestrator should flag this
  and ask the user before dispatching batch 2.
