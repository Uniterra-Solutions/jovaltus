---
name: to-tasks
description: >
  Decomposes implementation specs into a flat set of complete vertical
  slices for worktree execution. Each task bundles its own implementation
  + tests + full referenced code context — zero external lookups needed.
  Tasks are intentionally larger (30-60 min) to eliminate cross-worktree
  coordination.

  Two modes: (1) Fully Parallel — all tasks run simultaneously with
  disjoint file ownership (preferred). (2) Batch Execution — sequential
  batches when genuine cross-task dependencies cannot be eliminated.

  Produces manifest + per-task files under .plan/<DD-MM-YYYY>/<name>/tasks/.
  LOAD when:
  - Implementation specs exist; user is ready to orchestrate execution
  - User says "break into tasks" or "orchestrate" or "create task list"
  - User mentions parallel execution, worktree isolation, task DAG
  Do NOT use for:
  - Writing specs (use to-spec)
  - Writing code directly
  - Tasks where file-level independence is impossible
author: LaiTszKin
version: 0.4.0
metadata:
  jovaltus:
    tags: [orchestration, tasks, subagent, parallel, worktree, independent, batch]
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

## Two Modes

to-tasks supports two decomposition strategies. **Always attempt fully
parallel first** — it is simpler, faster, and the default. Only fall back
to batch execution when genuine dependencies survive every attempt to
eliminate them.

### Mode 1: Fully Parallel (Preferred — Default)

All tasks own disjoint files and have zero logical dependencies. Every
task can run simultaneously in isolated worktrees. This is the ideal:
minimal coordination, maximum throughput, simplest execution.

**Decision gate:** Can every task pass the self-containment test?
- Its verification command works with zero other task code present
- Its code imports nothing owned by another task
- A subagent implementing it never needs to know what other tasks are doing

→ **YES**: Use fully parallel mode. Proceed to Phase 1 normally.
  All tasks get dispatched at once. The manifest has no batch columns.

### Mode 2: Batch Execution (Fallback)

When genuine cross-task dependencies exist that cannot be eliminated,
decompose into sequential batches. Within each batch, tasks are
parallel-safe (disjoint files, no internal dependencies). Between
batches, later batches depend on earlier batches' output.

**When to fall back to batch mode** (try Mode 1 first, then each of
these remedies, then fall back only when none work):

1. Task B genuinely needs Task A's module to compile — a cross-task
   Python import that cannot be resolved by restructuring or merging.
2. Task B needs data model definitions, base classes, or interfaces
   that Task A creates (but merging A + B would create a task too
   large or unfocused).
3. A shared foundation layer (database schema, core types, plugin
   registry) must exist before feature tasks can be written, and
   the foundation is large enough to justify its own task.

**Remedies to try before falling back:**
1. **Merge** dependent tasks into one larger task (accept the size
   increase — a 90-min self-contained task beats two 30-min tasks
   that need cross-batch coordination).
2. **Restructure** so neither task needs the other — extract the
   shared dependency into its own file, assign it to the task that
   creates it, and have both tasks own their consumers independently.
3. **Lazy registration pattern** (see `references/lazy-registration-pattern.md`)
   for shared registry/entry-point files — resolves file-edit conflicts
   but does NOT solve cross-task imports.

→ **Only when ALL remedies fail**: Use batch mode.

**Batch structure:**
- **Batch 1**: Foundation — shared infrastructure, core types, base
  classes, registries, database schema. Creates what other batches
  consume.
- **Batch 2**: Feature tasks — consume Batch 1 output. May create
  additional shared modules that Batch 3 consumes.
- **Batch N**: Polish/integration — consume all prior batches.
- Within the same batch: tasks are fully parallel, disjoint files.
- Across batches: tasks may share files (sequential execution
  prevents write conflicts).

**Manifest differences for batch mode:**
- Manifest declares `mode: batch` and lists batch count.
- Task inventory includes a "Batch" column grouping tasks.
- File ownership map validates within-batch disjointness, not
  cross-batch (cross-batch overlap is intentional — later batches
  build on earlier ones).
- "Depends On" column documents which prior-batch tasks each task
  consumes (so `execute` knows merge order).

## Acceptance Criteria

- Every task is a complete vertical slice: implementation + tests + referenced
  context all in one TASK.md — no external lookups needed
- Every test file owned by the same task as the code it tests — tests are
  NEVER split from their implementation
- **Fully parallel mode**: Zero file write conflicts — every file owned by
  exactly one task
- **Batch mode**: Zero file write conflicts within each batch; cross-batch
  file overlap is permitted and documented in the manifest
- Every READ file's content (full source or key excerpts) inlined in the task
- Every task includes: file ownership, verification command, full spec + design
  excerpts + referenced file contents + project rules (all inline)
- Manifest: flat inventory with file ownership map proving within-batch
  disjointness, mode declaration, and batch dependency documentation

## Core Principles

**Flat, fully independent (Mode 1 — default).** Every task is a closed system.
No task imports from, references, or depends on another task's output. If you
find yourself thinking "Task B needs X from Task A to work" — merge A and B
into one task, restructure so neither needs the other, or apply the lazy
registration pattern. Only when all three remedies fail, fall back to batch
mode (Mode 2).

**Batch mode is a last resort, not a first choice.** Batch execution adds
coordination overhead: inter-batch merges, sequential wait time, and more
complex integration. Every batch you add roughly doubles the execution
pipeline's wall-clock time. Prefer a larger self-contained task over two
smaller batch-dependent tasks.

**Complete vertical slice over small tasks.** Each task owns its entire
vertical: implementation code, its tests, and any local supporting files
(config stubs, fixtures, type stubs). Tests are NEVER split from the code
they test. A task may be larger (30-60 min, up to 90 min for merged tasks) —
this is an intentional trade-off. A bigger self-contained task that runs
without coordination is cheaper than two smaller tasks that need cross-batch
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

### Phase 0: Assess Mode

Before building the file ownership map, decide: fully parallel or batch?

1. Read all specs. For each pair of specs that touch related files, ask:
   "Does Spec B genuinely need Spec A's code to compile or run?"
2. If YES: try merging A and B. Does the merged task stay under ~90 min
   and remain focused on one concern?
3. If merging fails (too large, too unfocused): try restructuring. Can
   the shared dependency be extracted into its own file that A owns, with
   B consuming it independently?
4. If restructuring fails: try lazy registration for registry files.
5. If ALL fail: document the dependency. This is a batch boundary.

**Result**: declare mode (`parallel` or `batch`) and if batch, sketch
batch groupings. Inform the user before proceeding to Phase 1.

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

**Fully parallel mode**: Prove no two specs share a write target. Only
one spec edits any given file. Resolve conflicts before proceeding.

**Batch mode**: Prove no two specs WITHIN THE SAME BATCH share a write
target. Cross-batch file overlap is permitted (and expected — later
batches build on earlier ones). Document all cross-batch overlaps in
the manifest's dependency notes.

### Phase 3: Write Task Files

Group related specs into task-sized vertical slices (3-5 tasks total).
For each resulting task: load `assets/task-template.md`. Fill:
- File Ownership (CREATE/EDIT/READ — zero write overlap WITHIN THE SAME BATCH)
- **Tests included** — every implementation file's tests owned by this same task
- **Referenced Code** — full content of every READ file the subagent needs
  to understand (copy-paste source, don't just list paths).
  **Batch mode addition**: For tasks in batch 2+, also include key excerpts
  from batch 1 files they depend on, so the subagent knows the interfaces
  it will consume after the inter-batch merge.
- Full spec inline (copy, don't link)
- Design excerpts (only relevant parts)
- Project rules (relevant boundaries)
- Verification command (must work in isolation within its batch — for batch 2+
  tasks, the verification works after merging batch 1 output into its worktree)

Every task must pass the **self-containment test**: "Can a subagent with
ONLY this TASK.md and the existing repo files implement correctly — without
reading any other task file, spec, or design doc?"

**Batch mode self-containment**: For batch 2+ tasks, the test becomes:
"Can a subagent with this TASK.md, the existing repo files, AND the
merged output of prior batches implement correctly?"

### Phase 4: Write Manifest

Load `assets/manifest-template.md`. Fill:
- **Mode declaration**: `parallel` or `batch`
- Task Inventory: flat table — ID, slug, batch (if batch mode), owns tests,
  file ownership, worktree path, branch, depends on (if batch mode),
  verification command
- File Ownership Map: proves zero overlap within each batch; cross-batch
  overlaps are documented
- Execution Status: pre-filled ⬜ pending (updated by `execute` skill)

### Phase 5: Validate + Confirm

Cross-check:
- **Fully parallel**: Every project file touched → exactly one owner
- **Batch mode**: Every project file touched → exactly one owner PER BATCH;
  cross-batch overlaps are explicit and documented
- Every implementation file → its test file owned by the SAME task
- Every READ file → full content or key excerpts inlined in the consuming task
- **All specs fully covered** — every requirement in every spec file is
  addressed by at least one task
- Every task → can be verified in isolation (for batch 2+ tasks: verifiable
  after merging prior-batch output)
- **Batch mode only**: Dependency chain is acyclic — no circular batch
  dependencies; batch 1 has no Depends On entries

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
- **No cross-task dependencies in fully parallel mode.** If you find
  yourself writing "Task B imports from Task A" or "Task C needs Task D's
  output" — the split is wrong. Merge them into one task, or restructure so
  neither needs the other. If merging makes the task too large (>90 min) or
  unfocused, document the dependency and switch to batch mode. But batch
  mode is a last resort — always try merging first.
- **Batch mode is a tax, not a feature.** Every batch adds coordination
  overhead: sequential wait time, inter-batch merges, and integration
  complexity. Only use batch mode when ALL remedies (merge, restructure,
  lazy registration) have been exhausted. A single 90-min task is cheaper
  than two 30-min tasks in separate batches.
- **Batch 1 is the foundation — keep it tight.** Only put truly shared
  infrastructure in batch 1: core types, base classes, database schema,
  plugin registries. If something COULD live in a feature task's batch,
  it should. Batch 1 scope creep is the #1 cause of slow batch pipelines.
- **Cross-batch dependencies must be acyclic.** Batch 2 → Batch 3 is fine.
  Batch 2 → Batch 1 is circular and means the decomposition is wrong.
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
- **Don't over-decompose.** Each task = 30-60 min for a subagent is fine
  (up to 90 min for merged tasks). Splitting further adds orchestration
  overhead with zero parallelism gain. **Bigger self-contained tasks are
  better than many small interdependent ones.**
- **Logical independence > file independence.** File-level disjointness is
  necessary but not sufficient. A task is truly independent only when: (1) its
  verification command passes with zero other task code present (or, for batch
  2+ tasks, with prior-batch output merged), (2) its code imports nothing owned
  by another task in the same batch, and (3) a subagent implementing it never
  needs to know what other same-batch tasks are doing. If any of these fail,
  merge tasks until they pass.
- **Fewer tasks is often better.** 2 large self-contained tasks are better than
  5 small ones that can't actually run in parallel. Self-containment is the
  primary goal; task count is secondary. Same applies to batches: 2 batches of
  2 tasks each is better than 4 batches of 1 task each.

## References

- `assets/task-template.md` — Self-contained task structure with placeholders.
  Load during Phase 3 per task.
- `assets/manifest-template.md` — Flat manifest: inventory, ownership map,
  status table. Load during Phase 4.
