---
name: to-tasks
description: >
  Decomposes implementation specs into a set of fully independent,
  self-contained task files for parallel execution. Every task has
  zero shared write files — all tasks can run simultaneously. Any
  cross-task dependencies (API shapes, function signatures) are
  inlined as interface contracts so subagents need only their own
  TASK.md. Produces a flat manifest and per-task files under
  .plan/<DD-MM-YYYY>/<name>/tasks/.
  LOAD when:
  - Implementation specs exist and user is ready to orchestrate execution
  - User says "break into tasks" or "create task list" or "orchestrate"
  - User asks to prepare subagent work packages
  - User mentions parallel execution, worktree isolation, or task DAG
  Do NOT use for:
  - Writing specs (use to-spec)
  - Writing code directly
  - Tasks where file-level independence is impossible
author: LaiTszKin
version: 0.2.0
metadata:
  jovaltus:
    tags: [orchestration, tasks, subagent, parallel, worktree, independent]
---

# To Tasks

## Goal

Decompose implementation specs into a flat set of fully independent,
self-contained task files. Every task owns a disjoint set of files —
zero shared write targets. All tasks can run simultaneously in parallel
worktrees with no merge conflicts.

Cross-task dependencies (e.g., "T3 needs to call T1's API") are resolved
at spec time by inlining the interface contract into every task that
needs it. No task waits for another task's output.

The output is a flat manifest + per-task files under
`.plan/<DD-MM-YYYY>/<name>/tasks/`.

## Acceptance Criteria

- Every task file is fully self-contained — a subagent reading ONLY that
  file has all the context it needs to implement
- Zero file write conflicts across ALL tasks — every file is owned by
  exactly one task (CREATE or EDIT, never both)
- Cross-task interface contracts (API shapes, function signatures, data
  types) are inlined into every consuming task
- Every task includes its exact file ownership, verification command,
  and inline spec + design excerpts + project rules
- Manifest is a flat task inventory — no waves, no ordering, just a list
  of independent work packages with worktree paths

## Core Principles

**Flat, not DAG.** The dependency graph is informational — it shows
logical relationships between tasks. But execution is flat: all tasks
run in parallel because they share zero files. The DAG helps humans
understand the system design; it does not constrain execution order.

**Interface contract over file dependency.** When Task A needs to call
a function that Task B creates, Task A's TASK.md inlines the function
signature and expected behavior. Task A codes against the contract, not
against Task B's actual output. This is the same principle as programming
to an interface — the contract is the shared truth.

**File-level atomicity is mandatory.** Two tasks must never touch the
same file. If two specs require editing the same file, re-split the
work: either merge the specs into one task, or find a way to separate
the file changes into two disjoint files.

**Self-contained or don't ship.** A task file that requires the subagent to
read another file defeats the purpose. The subagent's context is exactly
the task file — nothing else. This enables git worktree isolation.

**Inline everything.** Each task file bundles:
- Its spec (full inline copy from the specs/ directory)
- Relevant design excerpts (only the parts that task needs)
- Interface contracts from other tasks (function signatures, types, API shapes)
- Project rules (boundaries, conventions from AGENTS.md or equivalent)
- Output declaration (what files/artifacts this task produces)

This duplication is intentional — it buys context isolation. Token cost of
duplication is cheaper than the coordination cost of shared references.

**All tasks = one wave.** 3-5 tasks is the sweet spot from research. Since
all tasks are independent, this is also the natural batch size for
parallel dispatch.

## Prerequisites

Before starting, verify:
1. Implementation specs exist at `.plan/<DD-MM-YYYY>/<name>/specs/*.md`
2. Design doc exists at `.plan/<DD-MM-YYYY>/<name>/design.md` (for excerpts)
3. Project root has conventions file (AGENTS.md, CLAUDE.md, or equivalent)

## Workflow

### Phase 1: Analyze File Ownership

1. Read all spec files from `.plan/<DD-MM-YYYY>/<name>/specs/`.
2. For each spec, identify:
   - What files it creates or edits
   - What shared types, functions, or APIs it exposes
   - What other specs might need from it (interface contracts)
3. Build a file ownership map. Every file path appears in exactly one
   spec. If a file appears in two specs, re-split until ownership is
   exclusive.

### Phase 2: Extract Interface Contracts

4. For each spec, identify its public surface — what other tasks need to
   know about this task's output:
   - Function signatures and docstrings
   - Class / type definitions
   - API endpoint shapes (method, path, request/response schema)
   - Database table schemas this task creates
   - Config keys or environment variables this task introduces
5. Build a contract map: each contract belongs to one producing task.

### Phase 3: Assign File Ownership

6. Validate: no two specs share a write target. If they do, resolve before
   proceeding — split differently, or merge specs.
7. For each spec that needs to EDIT an existing file (brownfield), note it.
   Only one spec edits any given file.

### Phase 4: Build Task Files

For each spec in the flat list:

8. Load `assets/task-template.md` for structure.
9. Fill every section:
   - **File Ownership**: exact list of CREATE and EDIT files. Zero overlap
     with any other task.
   - **Interface Contracts from Others**: for every other task whose output
     this task needs, inline the function signature, type definition, or API
     shape. The subagent codes against these contracts.
   - **Interface Contract Exported**: what this task produces that other
     tasks will consume. Used by the orchestrator to extract contracts for
     dependent tasks.
   - **Spec**: copy the full spec inline — do not reference, do not link
   - **Design Excerpts**: extract only relevant parts from design.md
   - **Project Rules**: inline the relevant boundaries from the project's
     conventions file
   - **Verification**: exact command that proves this task is done,
     functional in isolation (should not require other tasks' output to pass)

10. Each task file must pass the self-containment test: "Can a subagent with
    ONLY this file implement the task correctly?"

### Phase 5: Build Dependency Graph (Informational)

11. Create a dependency graph showing which tasks logically depend on which:
    - T1 produces `src/auth/jwt.py` → T3 needs JWT shapes to build middleware
    - T2 produces `src/models/user.py` → T1, T3 both need the User model
    - The graph is **purely informational** — it helps understand the system
      design. It does NOT constrain execution order because every task that
      needs something from another task already has it inlined as a contract.

### Phase 6: Write Manifest

12. Load `assets/manifest-template.md` for structure.
13. Fill the manifest with:
    - **Task Inventory**: flat table — every task's ID, slug, file ownership,
      worktree path, branch name, verification command. This is the
      machine-readable index that `to-environment` and `execute` read.
    - **File Ownership Map**: which task owns every file. Proves zero overlap.
    - **Interface Contract Map**: which task exports which contracts, and
      which tasks consume them. Proves every dependency is covered by an
      inlined contract.
    - **Dependency Graph**: informational ASCII art DAG.
    - **Execution Status**: status table pre-filled with ⬜ pending. The
      `execute` skill updates this table.

### Phase 7: Validate

14. Cross-task validation:
    - Every file in the project touched by any spec belongs to exactly one task
    - Every cross-task interface dependency has a contract inlined in the
      consuming task's TASK.md
    - Every task passes the self-containment test
    - Every spec from specs/ is covered by exactly one task

15. Present the manifest and ask for user confirmation.

## Document Output

### Directory Structure

```
.plan/<DD-MM-YYYY>/<name>/tasks/
├── manifest.md              # Flat task inventory + status table
├── task-{{id}}-{{slug}}.md  # Self-contained task file
├── task-{{id}}-{{slug}}.md
└── ...
```

No `shared/` directory. No waves. Every task file is self-contained.

## Gotchas

- **Interface contracts are promises, not guarantees.** Task A inlines
  "Task B will create `src/auth/jwt.py` with function `create_token(user_id) -> str`."
  If Task B produces a different signature, the integration test (which
  reads real code, not contracts) will catch it. Contracts reduce but
  don't eliminate integration risk.
- **File conflicts are the #1 failure mode.** Two subagents editing the
  same file = guaranteed merge conflict. The file ownership map must be
  proven disjoint before task files are written.
- **"Read" is for brownfield context, not dependency.** When a task
  marks a file as READ, it means the subagent reads the existing code
  for understanding. READ files are included in the worktree by
  `to-environment`. READ is never a substitute for inlined contracts.
- **Don't over-decompose.** Each task should be a meaningful unit of work
  (15-30 min for a subagent). Splitting a 15-min task into three 5-min
  tasks adds orchestration overhead with no parallelism gain.
- **Verification must work in isolation.** The verification command
  must pass without other tasks' code existing. If the test imports
  `src/auth/jwt.py` but that file is owned by T2 and doesn't exist yet,
  either inline a stub or restructure the test to be self-contained.

## References

- `assets/task-template.md` — Self-contained task file structure with
  `{{placeholder}}` tokens. Load during Phase 4 for each task.
- `assets/manifest-template.md` — Flat task inventory with file ownership
  map, interface contract map, dependency graph, and execution status
  table. Load during Phase 6.
