---
name: execute
description: >
  Dispatches subagents into all prepared git worktrees simultaneously.
  Reads the flat task manifest and spawns every task in parallel via
  terminal(background=true) with workdir locked to each task's worktree.
  Each subagent runs hermes chat -q, reads TASK.md, implements, and
  verifies. All tasks run concurrently because they own disjoint files.
  Updates the manifest execution status table.
  LOAD when:
  - Worktrees exist under .worktrees/ and manifest exists
  - User says "execute" or "run the tasks" or "dispatch" or "執行"
  - Ready to spawn subagents from the prepared worktrees
  Do NOT use for:
  - Creating tasks or worktrees (use to-tasks, to-environment)
  - Running a single task manually
  - Tasks without a manifest + worktrees already prepared
author: LaiTszKin
version: 0.2.0
metadata:
  jovaltus:
    tags: [execution, subagent, worktree, parallel, dispatch, flat]
---

# Execute

## Goal

Dispatch subagents into all prepared git worktrees simultaneously. Every
task runs in parallel because they own disjoint sets of files — guaranteed
by the manifest's file ownership map. Each subagent runs isolated in its
own worktree with `hermes chat -q`, reads `TASK.md`, implements against
inlined interface contracts, and verifies the result.

## Acceptance Criteria

- Every task in the manifest is dispatched
- All tasks run in parallel via `terminal(background=true, workdir=<path>)`
- Each subagent is locked to its worktree — cannot escape to parent directory
- Failed tasks are identified and reported; the orchestrator decides: retry,
  skip, or halt the pipeline
- Manifest execution status table is updated as tasks complete

## Core Principles

**Flat parallel dispatch.** All tasks start at once. No waves. No ordering.
The file ownership map in the manifest proves zero shared write targets,
so parallel execution is safe by construction.

**Worktree = isolation boundary.** Each subagent runs via:
```
terminal(
    command="hermes chat -q '<prompt>'",
    workdir=".worktrees/<id>-<slug>",
    background=true,
    notify_on_complete=true
)
```
The `workdir` parameter locks the subagent into its worktree. The subagent
cannot escape — it sees only the files in that worktree and codes against
the inlined interface contracts in its `TASK.md`.

**hermes chat -q, not delegate_task.** `delegate_task` does not support
per-subagent working directories. We spawn full `hermes chat -q` processes,
each with its own `workdir`. True filesystem isolation; the trade-off is
losing `delegate_task`'s inline summary — but the subagent's final reply
serves the same purpose.

**Task file is the sole instruction.** Each worktree contains `TASK.md`
at its root. The subagent command:
> Read TASK.md at the root of this directory. It contains your complete
> task spec, interface contracts from other tasks, design excerpts, project
> rules, file ownership, and verification command. Implement everything.
> Work only in this directory. Run the verification command to prove completion.

## Prerequisites

1. Manifest exists at `.plan/<DD-MM-YYYY>/<name>/tasks/manifest.md`
2. Worktrees exist under `.worktrees/<id>-<slug>/` with `TASK.md` at root
3. `hermes` CLI is available in PATH

## Workflow

### Phase 1: Load the Manifest

1. Read `manifest.md` and extract the Task Inventory table:
   - Each task's ID, slug, worktree path, branch, verification command
2. Confirm the file ownership map shows zero overlaps. If any file has
   two owners, stop — the manifest is broken. Tell the user to re-run
   `to-tasks`.

### Phase 2: Spawn All Tasks

3. For every task in the inventory, spawn simultaneously:
   ```
   terminal(
       command="hermes chat -q \"Read TASK.md at the root of this directory. It contains your complete task spec, interface contracts from other tasks, design excerpts, project rules, file ownership list, and verification command. Implement everything specified. Work only in this directory — do not read or write files outside it. When done, run the verification command from TASK.md and report pass or fail.\"",
       workdir=".worktrees/<id>-<slug>",
       background=true,
       notify_on_complete=true,
       timeout=1800
   )
   ```
   Collect all `session_id` values mapped to task IDs.

4. **Mark all tasks 🟡 running** in the manifest status table.

### Phase 3: Collect Results

5. For each spawned process, use `process(action='wait', session_id=<id>)`
   to block until the subagent finishes. Since all processes were spawned
   in parallel, you can wait for them in any order. Check exit code:
   - 0 → 🟢 passed
   - Non-zero → 🔴 failed

6. **Update manifest status table** with results as they complete.

### Phase 4: Report

7. Print a summary:

   ```
   ## Execution Complete

   🟢 T1: register (2 files, 4 tests passed)
   🟢 T2: login (2 files, 3 tests passed)
   🔴 T3: verify-email (VERIFICATION FAILED — see output)
   🟢 T4: session (2 files, 5 tests passed)

   Total: 3/4 passed, 1 failed
   ```

8. For failed tasks, show the subagent's final output excerpt so the
   user can diagnose without opening worktrees.

### Phase 5: Handle Failures

9. Ask the user what to do with failed tasks:
   - **Retry**: re-dispatch the failed task (possibly with modified TASK.md)
   - **Skip**: leave the worktree as-is for manual fix, proceed
   - **Halt**: stop and let the user resolve before continuing

## Subagent Command Template

The exact `hermes chat -q` prompt:

```
Read TASK.md at the root of this directory. It contains your complete task
specification: what to build, interface contracts from other tasks, design
decisions, project rules, file ownership, and the exact verification command.
Implement everything specified. Code against the interface contracts — other
tasks will implement the real implementations; your tests should work with
the contracts as described. Work only in this directory — do not read or
write files outside it. When done, run the verification command listed in
TASK.md and report whether it passed.
```

## Cleanup

After all tasks pass:

```bash
# List worktrees
git worktree list

# Merge branches (review first)
git merge agent/<id>-<slug>

# Remove worktree
git worktree remove .worktrees/<id>-<slug>

# Clean stale metadata
git worktree prune

# Delete merged branches
git branch -d agent/<id>-<slug>
```

The `execute` skill does NOT auto-merge or auto-cleanup. It stops at
execution completion.

## Gotchas

- **3-5 concurrent subagents is the sweet spot.** If the manifest has
  more than 5 tasks, the orchestrator should dispatch in batches of 3-5
  to avoid API rate limits and context pressure. More than 5 concurrent
  `hermes chat -q` processes also creates disk I/O contention.
- **Subagent has no awareness of siblings.** Subagents do not coordinate.
  They can't conflict because the file ownership map guarantees disjoint
  write targets. Interface contracts handle the logical coupling.
- **`terminal(background=true)` returns immediately.** The `session_id`
  is your handle. Use `process(action='wait', session_id=<id>)` to block.
- **`hermes chat -q` timeout.** Default terminal timeout is 180s. Set
  `timeout=1800` (30 min) for implementation tasks.
- **Subagent model.** The subagent uses the same model as the parent
  unless you set `HERMES_MODEL` in the environment. For parallel dispatch,
  consider a cheaper model for subagents.
- **Stale worktrees.** If `to-environment` was run again, old worktrees
  under `.worktrees/` may not match the current manifest. Always run
  `to-environment` before `execute`.
- **Interface contracts reduce but don't eliminate integration risk.**
  If two tasks disagree on a contract (one implements it differently),
  the unit tests in each worktree will still pass because they test
  against the contract. An integration test run AFTER merging all
  branches is recommended.
