---
name: execute
description: >
  Dispatches subagents into isolated git worktrees wave by wave. Reads
  the task manifest, spawns all tasks in a wave simultaneously via
  terminal(background=true) with workdir locked to each task's worktree,
  waits for completion, and proceeds to the next wave. Each subagent
  runs hermes chat -q inside its worktree and reads TASK.md for
  instructions. Updates the manifest execution status table.
  LOAD when:
  - Worktrees exist under .worktrees/ and manifest exists
  - User says "execute" or "run the tasks" or "dispatch" or "執行"
  - Ready to spawn subagents from the prepared worktrees
  Do NOT use for:
  - Creating tasks or worktrees (use to-tasks, to-environment)
  - Running a single task manually
  - Tasks without a manifest + worktrees already prepared
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [execution, subagent, worktree, parallel, dispatch]
---

# Execute

## Goal

Dispatch subagents into prepared git worktrees, wave by wave. Each subagent
runs in its own worktree, reads `TASK.md`, implements the task, and verifies
the result. The orchestrator (you) manages wave ordering: all tasks in Wave N
complete before Wave N+1 starts.

## Acceptance Criteria

- Every task in the manifest is dispatched
- Tasks within the same wave run in parallel via `terminal(background=true)`
- Wave N+1 only starts after ALL tasks in Wave N have completed (exit code 0)
- Each subagent runs isolated in its worktree (`workdir=<worktree-path>`)
- Failed tasks are reported immediately; the orchestrator decides: retry,
  skip, or halt the pipeline
- Manifest execution status table is updated after each wave completes

## Core Principles

**Wave-gated parallelism.** Execute one wave at a time. All tasks in the
current wave start simultaneously. The orchestrator blocks until every
task in the wave finishes. Only then does the next wave start. This
enforces the DAG's dependency order without complex coordination.

**Worktree = isolation boundary.** Each subagent runs via:
```
terminal(
    command="hermes chat -q '<prompt>'",
    workdir=".worktrees/<wave>-<id>-<slug>",
    background=true,
    notify_on_complete=true
)
```
The `workdir` parameter locks the subagent into its worktree. The subagent
cannot escape — it sees only the files in that worktree.

**hermes chat -q, not delegate_task.** `delegate_task` does not support
per-subagent working directories. Instead, we spawn full `hermes chat -q`
processes, each with its own `workdir`. This gives us true filesystem
isolation at the cost of losing `delegate_task`'s inline summary — but
the subagent's final reply serves the same purpose.

**Task file is the sole instruction.** Each worktree contains `TASK.md`
at its root. The subagent command includes:
> Read TASK.md at the root of this directory. It contains your complete
> task spec, design excerpts, project rules, and verification command.
> Implement everything in the spec. Work only in this directory.
> Run the verification command to prove completion.

## Prerequisites

1. Manifest exists at `.plan/<DD-MM-YYYY>/<name>/tasks/manifest.md`
2. Worktrees exist under `.worktrees/<wave>-<id>-<slug>/` with `TASK.md`
3. `hermes` CLI is available in PATH

## Workflow

### Phase 1: Load the Manifest

1. Read `manifest.md` and extract:
   - Total waves (M)
   - Per-wave task list: IDs, slugs, worktree paths, verification commands
   - Dependency edges (for context only — wave ordering already encodes them)

### Phase 2: Wave Loop

For each wave W = 1 to M:

2. **Announce the wave:**
   ```
   ## Wave W: Dispatching N tasks in parallel
   - T1: <slug> → .worktrees/W-<id>-<slug>/
   - T2: <slug> → .worktrees/W-<id>-<slug>/
   ...
   ```

3. **Spawn all tasks in this wave simultaneously:**
   For each task in the wave, call:
   ```
   terminal(
       command="hermes chat -q \"Read TASK.md at the root of this directory. It contains your complete task spec. Implement everything. Work only in this directory. When done, run: <verification-command>. Report pass/fail.\"",
       workdir=".worktrees/<wave>-<id>-<slug>",
       background=true,
       notify_on_complete=true,
       timeout=1800
   )
   ```
   Collect all `session_id` values returned.

4. **Update status to 🟡 running** for all tasks in this wave.

5. **Wait for all tasks to complete:**
   For each spawned process, use `process(action='wait', session_id=<id>)`
   to block until the subagent finishes. Check exit code:
   - 0 → 🟢 passed
   - Non-zero → 🔴 failed

6. **Update manifest status table** with results.

7. **Handle failures:**
   - If any task fails, report the failure immediately.
   - Ask: continue to next wave (if dependencies allow), retry the failed
     task, or halt the pipeline.
   - Default: halt and let the user decide.

8. If all tasks passed → proceed to Wave W+1.

### Phase 3: Final Report

9. When all waves complete, print a summary:

   ```
   ## Execution Complete

   Wave 1: 🟢🟢 (2/2 passed)
   Wave 2: 🟢🟢 (2/2 passed)
   Wave 3: 🟢 (1/1 passed)

   Total: 5/5 passed, 0 failed
   Worktrees: .worktrees/
   Branches: agent/*
   ```

10. The user can now merge branches, review diffs, or clean up worktrees.

## Subagent Command Template

The exact `hermes chat -q` prompt passed to each subagent:

```
Read TASK.md at the root of this directory. It contains your complete task
specification: what to build, design decisions, project rules, and the
exact verification command. Implement everything specified. Work only in
this directory — do not read or write files outside it. When done, run
the verification command listed in TASK.md and report whether it passed.
```

**Why inline instead of a skill?** The subagent is a fresh `hermes chat -q`
process with no prior context. A skill would require pre-loading into the
subagent's session, which adds complexity. An inline prompt is self-contained
and works identically for every subagent.

## Failure Handling

| Scenario | Action |
|----------|--------|
| One task fails in Wave N | Report immediately. User decides: retry, skip, halt |
| Subagent never starts (process error) | Retry once. If still fails, mark 🔴 and ask user |
| Verification fails | Subagent's output includes error details. Mark 🔴 |
| Subagent times out (30 min default) | Mark 🔴 with timeout reason |
| All tasks in wave fail | Halt pipeline by default — likely systemic issue |

## Cleanup

After all waves complete successfully:

```bash
# List worktrees
git worktree list

# Merge branches (review first)
git merge agent/<wave>-<id>-<slug>

# Remove worktree
git worktree remove .worktrees/<wave>-<id>-<slug>

# Clean stale metadata
git worktree prune

# Delete merged branches
git branch -d agent/<wave>-<id>-<slug>
```

The `execute` skill does NOT auto-merge or auto-cleanup. It stops at
execution completion. Cleanup is a separate manual step or future skill.

## Gotchas

- **`terminal(background=true)` returns immediately.** The `session_id` in
  the response is your handle. Use `process(action='wait', session_id=<id>)`
  to block until the subagent completes. Do NOT use `process(action='poll')`
  in a loop — `wait` is more efficient.
- **Subagent has no awareness of siblings.** Even within the same wave,
  subagents do not coordinate. They can't conflict because the manifest
  guarantees zero shared write targets. This is intentional — coordination
  is the orchestrator's job.
- **`hermes chat -q` timeout.** Default terminal timeout is 180s. For
  tasks expected to take longer, set `timeout=1800` (30 min) or more.
- **Subagent model.** The subagent uses the same model as the parent
  unless you set `HERMES_MODEL` in the environment. For parallel dispatching,
  consider using a cheaper model for subagents.
- **Don't spawn more than 3-5 subagents concurrently.** The sweet spot
  from research. More than that and API rate limits + context management
  become bottlenecks. If a wave has >5 tasks, split it into sub-waves.
- **Manifest is the single source of truth.** If worktree paths in the
  manifest don't match actual file paths, `execute` fails. Always run
  `to-environment` before `execute` to ensure consistency.
