---
name: to-tasks
description: >
  Decomposes implementation specs into a flat set of complete vertical
  slices for parallel worktree execution. Each task bundles its own
  implementation + tests + full referenced code context — zero external
  lookups needed. Tasks are intentionally larger (30-60 min) to eliminate
  cross-worktree coordination. Produces manifest + per-task files under
  .plan/<DD-MM-YYYY>/<name>/tasks/.
  LOAD when:
  - Implementation specs exist; user is ready to orchestrate execution
  - User says "break into tasks" or "orchestrate" or "create task list"
  - User mentions parallel execution, worktree isolation, task DAG
  Do NOT use for:
  - Writing specs (use to-spec)
  - Writing code directly
  - Tasks where file-level independence is impossible
author: LaiTszKin
version: 0.3.0
metadata:
  jovaltus:
    tags: [orchestration, tasks, subagent, parallel, worktree, independent]
---

# To Tasks

## Goal

Decompose specs into flat, fully independent task files. Each task is a
**complete vertical slice**: implementation + tests + referenced code context
all in one worktree. Tasks can be larger (30-60 min) — the trade-off is
intentional: bigger self-contained units eliminate cross-worktree coordination
and enable true fire-and-forget parallel execution.

Zero shared write targets — all tasks run simultaneously in parallel
worktrees with zero merge conflicts. No cross-task dependencies of any kind:
every task is a self-contained, logically independent unit. Its verification
passes without any other task's code existing. Its implementation makes sense
without knowing what other tasks do.

## Acceptance Criteria

- Every task is a complete vertical slice: implementation + tests + referenced
  context all in one TASK.md — no external lookups needed
- Every test file owned by the same task as the code it tests — tests are
  NEVER split from their implementation
- Zero file write conflicts: every file owned by exactly one task
- Every READ file's content (full source or key excerpts) inlined in the task
- Every task includes: file ownership, verification command, full spec + design
  excerpts + referenced file contents + project rules (all inline)
- Manifest: flat inventory with file ownership map proving zero overlap and
  every task owns its own tests

## Core Principles

**Flat, fully independent.** Every task is a closed system. No task imports
from, references, or depends on another task's output. If you find yourself
thinking "Task B needs X from Task A to work" — merge A and B into one
task, or restructure so neither needs the other.

**Complete vertical slice over small tasks.** Each task owns its entire
vertical: implementation code, its tests, and any local supporting files
(config stubs, fixtures, type stubs). Tests are NEVER split from the code
they test. A task may be larger (30-60 min instead of 15-30) — this is an
intentional trade-off. A bigger self-contained task that runs without
coordination is cheaper than two smaller tasks that need cross-worktree
handshakes.

**Full context, not just contracts.** Interface contracts tell a task WHAT
another task produces. But the subagent also needs to understand HOW existing
code works. Every file marked READ in the ownership table must have its
content (full source or key excerpts) inlined in the task. The subagent
should NEVER need to look up another file — its TASK.md is the single source
of truth for its entire worktree context.

**Self-contained or don't ship.** The subagent's entire context is its
TASK.md. No linked files, no shared references, no runtime coordination.
This enables worktree isolation and parallel execution.

**Each task bundles inline:** full spec copy, relevant design excerpts,
full content of all READ files, project rules, output declaration.
Duplication is intentional — cheaper than coordination cost of shared
references.

## Prerequisites

1. Specs at `.plan/<DD-MM-YYYY>/<name>/specs/*.md`
2. Design at `.plan/<DD-MM-YYYY>/<name>/design.md`
3. Project conventions file exists (AGENTS.md, CLAUDE.md, etc.)

## Workflow

### Phase 1: Build File Ownership Map

Read all specs. For each: what files it creates/edits, what existing files
it needs to read for context, and — critically — what test files accompany
its implementation.

Map every file to exactly one task. If any file appears in two specs →
re-split until ownership is exclusive.

**Test ownership rule**: Every implementation file's test file(s) MUST be
owned by the same task. If spec A creates `src/auth/login.py`, the same
task owns `tests/auth/test_login.py`. Never split tests from their
implementation — this is a hard rule, not a guideline.

**READ context rule**: For every file marked READ, capture what the
subagent needs to understand. This content will be inlined in the task
file (Phase 3).

### Phase 2: Validate Ownership

Prove: no two specs share a write target. Only one spec edits any given
file. Resolve conflicts before proceeding.

### Phase 3: Write Task Files

Group related specs into task-sized vertical slices (3-5 tasks total).
For each resulting task: load `assets/task-template.md`. Fill:
- File Ownership (CREATE/EDIT/READ — zero write overlap with other tasks)
- **Tests included** — every implementation file's tests owned by this same task
- **Referenced Code** — full content of every READ file the subagent needs
  to understand (copy-paste source, don't just list paths)
- Full spec inline (copy, don't link)
- Design excerpts (only relevant parts)
- Project rules (relevant boundaries)
- Verification command (must work in isolation — no other tasks' output needed)

Every task must pass the **self-containment test**: "Can a subagent with
ONLY this TASK.md and the existing repo files implement correctly — without
reading any other task file, spec, or design doc?"

### Phase 4: Write Manifest

Load `assets/manifest-template.md`. Fill:
- Task Inventory: flat table — ID, slug, owns tests, file ownership,
  worktree path, branch, verification command
- File Ownership Map: proves zero overlap + every test owned by its
  implementation's task
- Execution Status: pre-filled ⬜ pending (updated by `execute` skill)

### Phase 5: Validate + Confirm

Cross-check:
- Every project file touched → exactly one owner
- Every implementation file → its test file owned by the SAME task
- Every READ file → full content or key excerpts inlined in the consuming task
- **All specs fully covered** — every requirement in every spec file is
  addressed by at least one task. Multiple specs can condense into one
  task; one spec can be split across tasks. Coverage, not 1:1 mapping.
- Every task → can be verified in isolation (its verification command works
  without any other task's output)

Present to user for confirmation.

## Gotchas

- **Tests ALWAYS travel with implementation.** A task that creates
  `src/feature/x.py` MUST also own `tests/feature/test_x.py`. Separating
  tests into their own task creates a coordination dependency that defeats
  worktree isolation. If this makes a task "too big," the answer is to
  accept the larger task — not to split tests out.
- **Specs → tasks is condensation, not 1:1 mapping.** Multiple spec files
  can (and should) be condensed into a single task when they form a coherent
  vertical slice. The goal is to distill ALL design-phase documents into
  3-5 self-contained tasks, not to produce one task per spec file.
- **No cross-task dependencies. Period.** If you find yourself writing "Task B
  imports from Task A" or "Task C needs Task D's output" — the split is wrong.
  Merge them into one task, or restructure so neither needs the other. There is
  no such thing as a "sequential wave," "stub file workaround," or
  "lazy registration pattern" — those are symptoms of bad task decomposition.
  Each task is a closed system: it owns every file it imports from and every
  file its tests need.
- **Shared entry-point files → one task owns the file.** When multiple specs
  need to register in a shared file (main.py, __init__.py, route registry),
  assign that file to exactly ONE task. The owning task creates the skeleton
  with all registration points. Other tasks create their modules independently
  and include instructions to append the registration call to the entry-point
  file during merge — the merge step is the ONLY cross-task coordination, and
  it happens AFTER all tasks complete independently.
- **READ is context with content, not just a file path.** READ files are for
  understanding existing code. Include their full source (or key excerpts) in
  the TASK.md — don't just list the file path. The subagent in its isolated
  worktree has the file on disk, but inlining the content ensures the subagent
  understands WHY this file matters and WHAT parts are relevant.
- **Don't over-decompose.** Each task = 30-60 min for a subagent is fine.
  Splitting further adds orchestration overhead with zero parallelism gain.
  **Bigger self-contained tasks are better than many small interdependent ones.**
- **Logical independence > file independence.** File-level disjointness is
  necessary but not sufficient. A task is truly independent only when: (1) its
  verification command passes with zero other task code present, (2) its code
  imports nothing owned by another task, and (3) a subagent implementing it
  never needs to know what other tasks are doing. If any of these fail, merge
  tasks until they pass.
- **Fewer tasks is often better.** 2 large self-contained tasks are better than
  5 small ones that can't actually run in parallel. Self-containment is the
  primary goal; task count is secondary.

## References

- `assets/task-template.md` — Self-contained task structure with placeholders.
  Load during Phase 3 per task.
- `assets/manifest-template.md` — Flat manifest: inventory, ownership map,
  status table. Load during Phase 4.
