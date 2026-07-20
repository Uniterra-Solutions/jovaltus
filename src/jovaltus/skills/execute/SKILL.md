---
name: execute
description: >
  Dispatches subagents into all prepared git worktrees simultaneously.
  Spawns every task in parallel via terminal(background=true) with
  workdir locked to each task's worktree. Each subagent runs
  hermes chat -q, reads TASK.md, implements, and verifies.
  All tasks run concurrently because they own disjoint files.
  Updates manifest execution status. Reports pass/fail per task.
  LOAD when:
  - Worktrees exist under .worktrees/ and manifest exists
  - User says "execute" or "run the tasks" or "dispatch" or "執行"
  - Ready to spawn subagents from prepared worktrees
  Do NOT use for:
  - Creating tasks or worktrees (use to-tasks, to-environment)
  - Running a single task manually
  - Tasks without manifest + worktrees already prepared
author: LaiTszKin
version: 0.2.1
metadata:
  jovaltus:
    tags: [execution, subagent, worktree, parallel, dispatch, flat]
---

# Execute

## Goal

Dispatch subagents into all prepared worktrees in parallel. Each subagent
runs isolated in its worktree, reads TASK.md, implements against inlined
contracts, and verifies. All tasks run simultaneously — guaranteed safe
by the manifest's disjoint file ownership.

## Acceptance Criteria

- Every manifest task is dispatched
- All run in parallel via `terminal(background=true, workdir=<path>)`
- Each subagent locked to its worktree — cannot escape to parent
- Failed tasks identified + reported; orchestrator asks: retry, skip, halt
- Manifest status table updated as tasks complete

## Core Principles

**Flat parallel dispatch.** All tasks start at once. The file ownership map
proves zero shared write targets — parallel execution is safe by construction.

**hermes chat -q, not delegate_task.** `delegate_task` doesn't support
per-subagent workdir. `terminal(workdir=<path>, background=true)` isolates
each subagent to its worktree. Trade-off: losing `delegate_task`'s inline
summary, but the subagent's final reply serves the same purpose.

**3-5 concurrent is the sweet spot.** More than 5 risks API rate limits,
context pressure, and disk I/O contention.

**Worktree is the isolation boundary.** The subagent sees only files in
its worktree. No coordination with siblings — impossible because file
ownership is disjoint by construction.

## Prerequisites

1. Manifest at `.plan/<DD-MM-YYYY>/<name>/tasks/manifest.md`
2. Worktrees at `.worktrees/<id>-<slug>/` with `TASK.md`
3. `hermes` CLI in PATH

## Workflow

### Phase 1: Verify Manifest

Read manifest. Confirm file ownership map has zero overlaps. If any file
has two owners → stop; manifest is broken. Tell the user to re-run `to-tasks`.

### Phase 2: Dispatch All Tasks

For every task, spawn simultaneously:
```
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

### Phase 3: Collect Results

For each process: `process(action='wait', session_id=<id>)`. Check exit
code: 0 → 🟢 passed, non-zero → 🔴 failed. Update manifest status.

### Phase 4: Report

Print summary — task ID, status, file count, test output. For failed tasks,
show subagent final output so user can diagnose.

### Phase 5: Handle Failures

Ask user: retry (re-dispatch, maybe with modified TASK.md), skip (leave
for manual fix), or halt (stop pipeline).

## Gotchas

- **Subagent has no awareness of siblings.** They don't coordinate — they
  can't conflict because the file ownership map is disjoint.
- **`terminal(background=true)` returns immediately.** The `session_id`
  is your handle. Use `process(action='wait', session_id=<id>)` to block.
- **Timeout.** Default 180s is too short. Set `timeout=1800` (30 min).
- **Subagent model.** Uses same model as parent. For cost savings, set
  `HERMES_MODEL` to a cheaper model before dispatch.
- **Stale worktrees.** Always run `to-environment` before `execute` if
  manifest was regenerated.
- **Interface contracts reduce integration risk, not eliminate it.** Two
  tasks disagreeing on a contract will both pass in isolation — an
  integration test after merging all branches is recommended.
- **Cleanup is NOT auto.** Execute stops at completion. Merge, worktree
  removal, and branch deletion happen in `review` phase.
