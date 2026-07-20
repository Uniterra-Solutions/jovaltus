---
name: to-tasks
description: >
  Decomposes implementation specs into a flat set of fully independent,
  self-contained task files for parallel worktree execution. Every task
  owns disjoint files — zero shared write targets. Cross-task dependencies
  resolved via inlined interface contracts. Produces manifest + per-task
  files under .plan/<DD-MM-YYYY>/<name>/tasks/.
  LOAD when:
  - Implementation specs exist; user is ready to orchestrate execution
  - User says "break into tasks" or "orchestrate" or "create task list"
  - User mentions parallel execution, worktree isolation, task DAG
  Do NOT use for:
  - Writing specs (use to-spec)
  - Writing code directly
  - Tasks where file-level independence is impossible
author: LaiTszKin
version: 0.2.1
metadata:
  jovaltus:
    tags: [orchestration, tasks, subagent, parallel, worktree, independent]
---

# To Tasks

## Goal

Decompose specs into flat, fully independent task files. Zero shared write
targets — all tasks run simultaneously in parallel worktrees with zero
merge conflicts. Cross-task dependencies (e.g., "T3 calls T1's API")
resolved by inlining interface contracts.

## Acceptance Criteria

- Every task self-contained: subagent reading ONLY that file has full context
- Zero file write conflicts: every file owned by exactly one task
- Cross-task interface contracts inlined into every consuming task
- Every task includes: file ownership, verification command, spec + design
  excerpts + project rules (all inline, no external references)
- Manifest: flat inventory with file ownership map proving zero overlap

## Core Principles

**Flat, not DAG.** The dependency graph is informational (helps humans
understand). Execution is flat — all tasks run in parallel because they
share zero files.

**Interface contract over file dependency.** Task A needs Task B's function?
Task A inlines the function signature and expected behavior. Codes against
the contract, not B's actual output. Same principle as programming to an
interface.

**Self-contained or don't ship.** The subagent's entire context is its
TASK.md. No linked files, no shared references, no runtime coordination.
This enables worktree isolation and parallel execution.

**Each task bundles inline:** full spec copy, relevant design excerpts,
interface contracts from other tasks (signatures, types, API shapes),
project rules, output declaration. Duplication is intentional — cheaper
than coordination cost of shared references.

## Prerequisites

1. Specs at `.plan/<DD-MM-YYYY>/<name>/specs/*.md`
2. Design at `.plan/<DD-MM-YYYY>/<name>/design.md`
3. Project conventions file exists (AGENTS.md, CLAUDE.md, etc.)

## Workflow

### Phase 1: Build File Ownership Map

Read all specs. For each: what files it creates/edits, what it exports
(interface contracts). Map every file to exactly one task. If any file
appears in two specs → re-split until ownership is exclusive.

### Phase 2: Extract Interface Contracts

For each spec: identify its public surface — function signatures, type
definitions, API shapes, DB schemas, config keys. Build a contract map:
each contract owned by one producing task.

### Phase 3: Validate Ownership

Prove: no two specs share a write target. Only one spec edits any given
file. Resolve conflicts before proceeding.

### Phase 4: Write Task Files

For each spec: load `assets/task-template.md`. Fill:
- File Ownership (CREATE/EDIT — zero overlap with other tasks)
- Interface Contracts from Others (inline every dependency's contract)
- Interface Contract Exported (what this task produces for others)
- Full spec inline (copy, don't link)
- Design excerpts (only relevant parts)
- Project rules (relevant boundaries)
- Verification command (must work in isolation — no other tasks' output needed)

Every task must pass: "Can a subagent with ONLY this file implement correctly?"

### Phase 5: Write Manifest

Load `assets/manifest-template.md`. Fill:
- Task Inventory: flat table — ID, slug, file ownership, worktree path,
  branch, verification command
- File Ownership Map: proves zero overlap
- Interface Contract Map: proves every dependency covered by inlined contract
- Dependency Graph: informational ASCII DAG
- Execution Status: pre-filled ⬜ pending (updated by `execute` skill)

### Phase 6: Validate + Confirm

Cross-check: every project file touched → exactly one owner. Every cross-task
dependency → contract inlined. Every spec → covered by exactly one task.
Present to user for confirmation.

## Gotchas

- **Interface contracts are promises, not guarantees.** Task A inlines "B creates
  `create_token(user_id) -> str`." If B produces a different signature, integration
  test catches it. Contracts reduce risk, don't eliminate it.
- **File conflicts = #1 failure mode.** Two subagents editing same file = guaranteed
  merge conflict. Proven disjoint before writing task files.
- **READ is context, not dependency.** READ files are for understanding existing
  code. Included in worktree by `to-environment`. Never a substitute for contracts.
- **Don't over-decompose.** Each task = 15-30 min for a subagent. Splitting further
  adds orchestration overhead with zero parallelism gain.
- **Verification must work in isolation.** If a test imports a file owned by
  another task that doesn't exist yet: inline a stub or restructure the test.
- **3-5 tasks is the sweet spot.** Match the natural batch size for parallel
  dispatch. More tasks = more orchestration, not more speed.

## References

- `assets/task-template.md` — Self-contained task structure with placeholders.
  Load during Phase 4 per task.
- `assets/manifest-template.md` — Flat manifest: inventory, ownership map,
  contract map, dependency graph, status table. Load during Phase 5.
