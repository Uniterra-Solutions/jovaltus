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
worktrees with zero merge conflicts. Cross-task dependencies (e.g., "T3 calls
T1's API") resolved by inlining interface contracts + full context of
referenced files.

## Acceptance Criteria

- Every task is a complete vertical slice: implementation + tests + referenced
  context all in one TASK.md — no external lookups needed
- Every test file owned by the same task as the code it tests — tests are
  NEVER split from their implementation
- Zero file write conflicts: every file owned by exactly one task
- Cross-task interface contracts inlined into every consuming task
- Every READ file's content (full source or key excerpts) inlined in the task
- Every task includes: file ownership, verification command, full spec + design
  excerpts + referenced file contents + project rules (all inline)
- Manifest: flat inventory with file ownership map proving zero overlap and
  every task owns its own tests

## Core Principles

**Flat, not DAG.** The dependency graph is informational (helps humans
understand). Execution is flat — all tasks run in parallel because they
share zero files.

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
interface contracts from other tasks (signatures, types, API shapes),
full content of all READ files, project rules, output declaration.
Duplication is intentional — cheaper than coordination cost of shared
references.

## Prerequisites

1. Specs at `.plan/<DD-MM-YYYY>/<name>/specs/*.md`
2. Design at `.plan/<DD-MM-YYYY>/<name>/design.md`
3. Project conventions file exists (AGENTS.md, CLAUDE.md, etc.)

## Workflow

### Phase 1: Build File Ownership Map

Read all specs. For each: what files it creates/edits, what it exports
(interface contracts), what existing files it needs to read for context,
and — critically — what test files accompany its implementation.

Map every file to exactly one task. If any file appears in two specs →
re-split until ownership is exclusive.

**Test ownership rule**: Every implementation file's test file(s) MUST be
owned by the same task. If spec A creates `src/auth/login.py`, the same
task owns `tests/auth/test_login.py`. Never split tests from their
implementation — this is a hard rule, not a guideline.

**READ context rule**: For every file marked READ, capture what the
subagent needs to understand. This content will be inlined in the task
file (Phase 4).

### Phase 2: Extract Interface Contracts

For each spec: identify its public surface — function signatures, type
definitions, API shapes, DB schemas, config keys. Build a contract map:
each contract owned by one producing task.

### Phase 3: Validate Ownership

Prove: no two specs share a write target. Only one spec edits any given
file. Resolve conflicts before proceeding.

### Phase 4: Write Task Files

Group related specs into task-sized vertical slices (3-5 tasks total).
For each resulting task: load `assets/task-template.md`. Fill:
- File Ownership (CREATE/EDIT/READ — zero write overlap with other tasks)
- **Tests included** — every implementation file's tests owned by this same task
- **Referenced Code** — full content of every READ file the subagent needs
  to understand (copy-paste source, don't just list paths)
- Interface Contracts from Others (inline every dependency's contract)
- Interface Contract Exported (what this task produces for others)
- Full spec inline (copy, don't link)
- Design excerpts (only relevant parts)
- Project rules (relevant boundaries)
- Verification command (must work in isolation — no other tasks' output needed)

Every task must pass the **self-containment test**: "Can a subagent with
ONLY this TASK.md and the existing repo files implement correctly — without
reading any other task file, spec, or design doc?"

### Phase 5: Write Manifest

Load `assets/manifest-template.md`. Fill:
- Task Inventory: flat table — ID, slug, owns tests, file ownership,
  worktree path, branch, verification command
- File Ownership Map: proves zero overlap + every test owned by its
  implementation's task
- Interface Contract Map: proves every dependency covered by inlined contract
- Dependency Graph: informational ASCII DAG
- Execution Status: pre-filled ⬜ pending (updated by `execute` skill)

### Phase 6: Validate + Confirm

Cross-check:
- Every project file touched → exactly one owner
- Every implementation file → its test file owned by the SAME task
- Every cross-task dependency → contract inlined
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
- **Cross-task Python imports FAIL in isolated worktrees.** Even with disjoint
  file ownership, if task B's code does `from alimentor.cli.foo import bar` and
  `foo.py` is owned by task A, the import fails — that file doesn't exist in
  B's worktree. Lazy registration solves shared-entry-point conflicts, but does
  NOT solve cross-task imports. Solutions (pick one):

  | Solution | When to use |
  |----------|-------------|
  | **Make tasks bigger + self-contained** | Preferred. Fewer, larger tasks that each own everything they import. "每個task即便大一點也沒關係，但確保每個task內部自己完成所有自己需要的內容" |
  | **Sequential waves with merges** | Tasks are natural dependency chain: T1 → commit → merge → T2 pulls → T3. Works when dependency order is linear. |
  | **Stub files** | Each task bundles its own stubs for other tasks' modules (`try: import X except: from _tN_stubs import X`). High maintenance, use only when truly parallel execution is required. |

- **Shared entry-point files → lazy registration.** When multiple tasks need to
  register in a shared entry-point file (main.py, __init__.py, route registry),
  use the **lazy registration pattern**: one foundation task owns the entry point
  and uses `importlib.import_module()` with `try/except ImportError` to auto-discover
  `register(target)` functions from modules created by other tasks. Full pattern
  in `references/lazy-registration-pattern.md`. **Note**: this alone does NOT
  solve cross-task imports — it only prevents conflicts on the registry file itself.

- **Interface contracts are promises, not guarantees.** Task A inlines "B creates
  `create_token(user_id) -> str`." If B produces a different signature, integration
  test catches it. Contracts reduce risk, don't eliminate it.

- **READ is context with content, not just a file path.** READ files are for
  understanding existing code. Include their full source (or key excerpts) in
  the TASK.md — don't just list the file path. The subagent in its isolated
  worktree has the file on disk, but inlining the content ensures the subagent
  understands WHY this file matters and WHAT parts are relevant. Never a
  substitute for interface contracts.

- **Don't over-decompose.** Each task = 30-60 min for a subagent is fine.
  Splitting further adds orchestration overhead with zero parallelism gain.
  **Bigger self-contained tasks are better than many small interdependent ones.**

- **Verification must work in isolation.** If a test imports a file owned by
  another task that doesn't exist yet: inline a stub or restructure the test.
  **Or better**: restructure tasks so no task needs to import from another.

- **Fewer tasks is often better.** The previous "3-5 sweet spot" guideline is
  secondary to self-containment. 2 large self-contained tasks are better than
  5 small ones that can't actually run in parallel due to import dependencies.

## References

- `assets/task-template.md` — Self-contained task structure with placeholders.
  Load during Phase 4 per task.
- `assets/manifest-template.md` — Flat manifest: inventory, ownership map,
  contract map, dependency graph, status table. Load during Phase 5.
- `references/lazy-registration-pattern.md` — Resolving shared entry-point file
  conflicts with importlib lazy registration. Load when Phase 1 discovers a file
  (main.py, __init__.py) that would be edited by multiple tasks.
