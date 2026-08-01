---
name: to-tasks
description: >
  Decomposes implementation specs into tasks for DAG-based worktree execution.
  The manifest (scheduling document) expresses every subagent relationship as
  a DAG: nodes = tasks, directed edges = "depends on", acyclic. Tasks at the
  same topological level run in parallel; levels execute sequentially with
  inter-level merges. Zero edges = fully parallel. Each task bundles its own
  implementation + tests + full referenced code context — zero external
  lookups needed. Tasks are intentionally larger (30-60 min) to keep levels
  flat.

  Produces manifest + per-task files under .plan/<DD-MM-YYYY>/<name>/tasks/.
  LOAD when:
  - Implementation specs exist; user is ready to orchestrate execution
  - User says "break into tasks" or "orchestrate" or "create task list"
  - User mentions parallel execution, worktree isolation, task DAG,
    dependencies between subagents
  Do NOT use for:
  - Writing specs (use to-spec)
  - Writing code directly (use execute)
  - Tasks where file-level independence within a level is impossible
---

# To Tasks

## Goal

Decompose specs into task files and a scheduling document (the manifest) that
expresses the relationships between all subagents as a **DAG** — a directed
acyclic graph. Each task is a **complete vertical slice**: implementation +
tests + referenced code context all in one TASK.md.

The DAG is the schedule:

- **Nodes** = tasks. Each task becomes one subagent during `execute`.
- **Directed edge** `T1 → T3` = "T3 depends on T1". T3 consumes T1's output,
  so T3 runs only after T1 completes and T1's branch is merged into the
  integration branch.
- **Acyclic by construction.** A cycle means the decomposition is wrong.
- **Level** = topological layer. Level 1 tasks have no dependencies.
  `level(T) = 1 + max(level(dep) for dep in T.deps)` (1 when no deps).
  Same-level tasks run in parallel; levels execute sequentially.
- **Zero edges = fully parallel.** A manifest where every task sits at
  Level 1 is the classic fully-parallel run — preferred whenever possible.

Every relationship is visible in the manifest: the DAG diagram
(mermaid + ASCII), the edge list, and the Level + Depends On columns in the
task inventory. **The scheduling document IS the DAG.** `execute` reads it
and dispatches level by level.

## Acceptance Criteria

- Every task is a complete vertical slice: implementation + tests + referenced
  context all in one TASK.md — no external lookups needed
- Every test file owned by the same task as the code it tests — tests are
  NEVER split from their implementation
- Manifest declares a DAG: nodes, edges, levels — acyclic, no missing edges
- Zero file write conflicts **within each level** (same-level tasks are
  parallel-safe)
- Cross-level file overlaps are explicit and documented (later levels build
  on earlier levels' output)
- Every READ file's content (full source or key excerpts) inlined in the task
- Every task at Level ≥ 2 includes key excerpts of the dependency interfaces
  it consumes (signatures, types, import paths)
- Every task includes: file ownership, verification command, full spec + design
  excerpts + referenced file contents + project rules (all inline)
- Manifest: flat inventory with file ownership map proving within-level
  disjointness, plus the task DAG (diagram + edge list + level table)
- Every requirement in every spec is covered by at least one task

## Core Principles

**Same-level independence; cross-level dependency as first-class edges.**
Within a level, tasks are closed systems: no imports, no shared write
targets, no knowledge of each other. Across levels, dependencies are
declared explicitly as DAG edges — not hidden handshakes. A dependency
edge is not a decomposition failure; it is the DAG model working as
intended. The pipeline can schedule real inter-subagent relationships
instead of pretending they don't exist.

**Prefer flat, but don't force it.** The default is a zero-edge DAG (all
tasks at Level 1). When a genuine dependency surfaces, first try the
remedies in order:
1. **Merge** the dependent tasks into one larger task (accept the size
   increase — a 90-min self-contained task beats two tasks that need a
   cross-level handshake).
2. **Restructure** so neither task needs the other — extract the shared
   dependency into its own file, assign it to the task that creates it,
   and have consumers own their code independently.
3. **Lazy registration pattern** (see `references/lazy-registration-pattern.md`)
   for shared registry/entry-point files.

Only when all three fail, keep the edge — it is a legitimate, documented
part of the DAG, and `execute` will sequence it correctly.

**Complete vertical slice over small tasks.** Each task owns its entire
vertical: implementation code, its tests, and any local supporting files
(config stubs, fixtures, type stubs). Tests are NEVER split from the code
they test. A task may be larger (30-60 min, up to 90 min for merged tasks) —
this is an intentional trade-off. A bigger self-contained task that runs
without coordination is cheaper than two smaller tasks that need a
cross-level handshake.

**Full context, not just contracts.** Interface contracts tell a task WHAT
another task produces. But the subagent also needs to understand HOW existing
code works. Every file marked READ in the ownership table must have its
content (full source or key excerpts) inlined in the task. The subagent
should NEVER need to look up another file — its TASK.md is the single source
of truth for its entire worktree context.

**Self-contained or don't ship.** The subagent's entire context is its
TASK.md. No linked files, no shared references, no runtime coordination.
This enables worktree isolation and level-parallel execution.

**Each task bundles inline:** full spec copy, relevant design excerpts,
full content of all READ files, project rules, output declaration.
Duplication is intentional — cheaper than coordination cost of shared
references. Level ≥ 2 tasks additionally inline the dependency interfaces
they will consume after the inter-level merge.

## Prerequisites

1. Specs at `.plan/<DD-MM-YYYY>/<name>/specs/*.md`
2. Design at `.plan/<DD-MM-YYYY>/<name>/design.md`
3. Project conventions file exists (AGENTS.md, CLAUDE.md, etc.)

## Workflow

### Phase 0: Identify Dependencies

Read all specs. For each pair of specs that touch related files, ask:
"Does Spec B genuinely need Spec A's code to compile or run?"

Apply the remedies in order — merge, then restructure, then lazy
registration — for every pair that fails the self-containment test. What
survives all three remedies becomes the dependency edge set.

Sketch the DAG: tasks as nodes, surviving dependencies as directed edges.
Assign provisional levels (`1 + max(dep levels)`). Inform the user before
proceeding: "N tasks, M edges, L levels" and the level breakdown.

### Phase 1: Build File Ownership Map

Read all specs. For each: what files it creates/edits, what existing files
it needs to read for context, and — critically — what test files accompany
its implementation.

Map every file to exactly one task **per level**. If any file appears in two
specs at the SAME level → re-split until ownership is exclusive.

**Test ownership rule**: Every implementation file's test file(s) MUST be
owned by the same task. If spec A creates `src/auth/login.py`, the same
task owns `tests/auth/test_login.py`. Never split tests from their
implementation — this is a hard rule, not a guideline.

**READ context rule**: For every file marked READ, capture what the
subagent needs to understand. This content will be inlined in the task
file (Phase 4).

### Phase 2: Validate Ownership

**Within each level**: prove no two tasks share a write target. Only one
task edits any given file at a given level. Resolve conflicts before
proceeding.

**Across levels**: cross-level file overlap is permitted — and expected,
since later levels build on earlier output. Document every cross-level
overlap in the manifest (file, earlier-level owner, later-level owner, why).

### Phase 3: Assign Topological Levels

Assign each task its level: `level(T) = 1 + max(level(dep) for dep in deps)`
(Level 1 when no deps). Verify:

- **Acyclic** — no path through the edges returns to its start. A cycle
  makes the level computation undefined; stop and re-decompose.
- **Consistent** — every edge points from a lower level to a higher level.
- **Complete** — every task's dependencies live entirely in earlier levels.

The level assignment is what `execute` will use to schedule dispatch.

### Phase 4: Write Task Files

Group related specs into task-sized vertical slices (3-5 tasks total is
typical; fewer is often better). For each resulting task: load
`assets/task-template.md`. Fill:

- File Ownership (CREATE/EDIT/READ — zero write overlap within the level)
- **Tests included** — every implementation file's tests owned by this same task
- **Referenced Code** — full content of every READ file the subagent needs
  to understand (copy-paste source, don't just list paths).
  **Level ≥ 2 addition**: also inline key excerpts from dependency tasks'
  files — class signatures, function signatures, type definitions, import
  paths. The subagent implements against these interfaces; the actual code
  is merged into its worktree by `execute` before the subagent runs.
- Full spec inline (copy, don't link)
- Design excerpts (only relevant parts)
- Project rules (relevant boundaries)
- Verification command (must work in isolation at its level — for Level ≥ 2
  tasks, after merging dependency output into its worktree)

Every task must pass the **self-containment test**: "Can a subagent with
ONLY this TASK.md and the existing repo files implement correctly — without
reading any other task file, spec, or design doc?"

**Level ≥ 2 self-containment**: the test becomes: "Can a subagent with this
TASK.md, the existing repo files, AND the merged output of all earlier
levels implement correctly?"

### Phase 5: Write Manifest (the scheduling document)

Load `assets/manifest-template.md`. Fill:

- **Execution model**: DAG — total tasks, total levels
- Task Inventory: flat table — ID, level, slug, owns tests, depends on,
  file ownership, worktree path, branch, verification command
- **Task DAG section**: mermaid diagram, ASCII diagram, edge list
  (task / depends on / why), level table — the subagent relationships in
  DAG form
- File Ownership Map: zero overlap within each level; cross-level overlaps
  documented
- Execution Status: pre-filled ⬜ pending (updated by `execute` skill)

### Phase 6: Validate + Confirm

Cross-check:

- DAG is acyclic; level assignment consistent with the edge list
- Every project file touched → exactly one owner per level
- Every implementation file → its test file owned by the SAME task
- Every READ file → full content or key excerpts inlined in the consuming task
- Every Level ≥ 2 task → dependency interface excerpts inlined
- **All specs fully covered** — every requirement in every spec file is
  addressed by at least one task
- Every task → can be verified in isolation at its level (Level ≥ 2 tasks:
  verifiable after merging earlier-level output)
- Dependency chain is acyclic — this is the DAG definition; Level 1 has no
  Depends On entries

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
- **Same-level tasks must never import each other.** If two tasks at the
  same level share an import, that is a DAG edge you missed — merge them,
  restructure so neither needs the other, or move one to a later level.
- **A cycle is a decomposition error, not a scheduling problem.** The DAG
  model cannot schedule circular dependencies. If you find one, merge the
  cycle into a single task.
- **Level 1 is the foundation — keep it tight.** Only put truly shared
  infrastructure in Level 1: core types, base classes, database schema,
  plugin registries. If something COULD live in a Level 2 task, it should.
  Level 1 scope creep is the #1 cause of long pipelines.
- **Cross-level dependencies must be acyclic — that's the DAG definition.**
  An edge from a later level back to an earlier level means the levels are
  wrong.
- **Shared entry-point files → one task owns the file per level.** When
  multiple specs need to register in a shared file (main.py, __init__.py,
  route registry), assign that file to exactly ONE task per level. The
  owning task creates the skeleton with all registration points. Other tasks
  create their modules independently and include instructions to append the
  registration call to the entry-point file during merge — the merge step is
  the ONLY cross-task coordination, and it happens AFTER all tasks at the
  level complete independently.
- **READ is context with content, not just a file path.** READ files are for
  understanding existing code. Include their full source (or key excerpts)
  in the TASK.md — don't just list the file path. The subagent in its
  isolated worktree has the file on disk, but inlining the content ensures
  the subagent understands WHY this file matters and WHAT parts are relevant.
- **Don't over-decompose.** Each task = 30-60 min for a subagent is fine
  (up to 90 min for merged tasks). Splitting further adds orchestration
  overhead with zero parallelism gain. **Bigger self-contained tasks are
  better than many small interdependent ones.**
- **Logical independence > file independence.** File-level disjointness is
  necessary but not sufficient. A task is truly independent only when:
  (1) its verification command passes with zero other same-level task code
  present (or, for Level ≥ 2 tasks, with all earlier-level output merged),
  (2) its code imports nothing owned by another task at the same level, and
  (3) a subagent implementing it never needs to know what other same-level
  tasks are doing. If any of these fail, merge tasks until they pass.
- **Fewer tasks is often better — and fewer levels too.** 2 large
  self-contained tasks are better than 5 small ones that can't actually run
  in parallel. Same applies to levels: 2 levels of 2 tasks each is better
  than 4 levels of 1 task each — every level boundary serializes the
  pipeline.

## References

- `assets/task-template.md` — Self-contained task structure with placeholders.
  Load during Phase 4 per task.
- `assets/manifest-template.md` — Scheduling document: task inventory, DAG
  section (mermaid + ASCII + edge list), ownership map, status table.
  Load during Phase 5.
- `references/lazy-registration-pattern.md` — Pattern for shared
  registry/entry-point files; one of the three remedies before declaring a
  dependency edge.
