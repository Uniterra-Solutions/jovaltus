---
name: to-tasks
description: >
  Decomposes implementation specs into a DAG of atomic, self-contained
  task files for parallel subagent execution. Each task file bundles its
  spec, design excerpts, project rules, and verification — zero external
  dependencies. Designed for git worktree isolation. Produces a manifest
  and per-task files under .plan/<DD-MM-YYYY>/<name>/tasks/.
  LOAD when:
  - Implementation specs exist and user is ready to orchestrate execution
  - User says "break into tasks" or "create task list" or "orchestrate"
  - User asks to prepare subagent work packages
  - User mentions parallel execution, worktree isolation, or task DAG
  Do NOT use for:
  - Writing specs (use to-spec)
  - Writing code directly
  - Single-agent sequential workflows
  - Tasks where every step depends on the previous one (no parallelism)
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [orchestration, tasks, subagent, parallel, worktree, dag]
---

# Task Orchestration

## Goal

Decompose implementation specs into a DAG of atomic, fully self-contained
task files. Each task file is a complete work package that a subagent can
execute in isolation — zero external file reads needed beyond the task
file itself.

Designed for git worktree isolation: each subagent checks out a single
task file with its own worktree, reads exactly that file, and implements.

The output is a manifest + per-task files under
`.plan/<DD-MM-YYYY>/<name>/tasks/`.

## Acceptance Criteria

- Every task file is fully self-contained — a subagent reading ONLY that
  file (no other project files, no shared references) has all the context
  it needs to implement
- Every task file includes: full spec inline, relevant design excerpts,
  project rules, exact file ownership, verification command
- DAG is correct: no missing dependencies, no false dependencies, no cycles
- File ownership has zero conflicts within the same wave (no two tasks
  in the same wave edit the same file)
- Each task produces at least one verifiable output artifact (file, test
  pass, endpoint response)
- Manifest clearly shows execution waves and dependency edges

## Core Principles

**Self-contained or don't ship.** A task file that requires the subagent to
read another file defeats the purpose. The subagent's context should be exactly
the task file — nothing else. This enables git worktree isolation where each
subagent works in a directory containing only its task file and the code it
produces.

**File-level atomicity.** Two tasks in the same wave must never touch the same
file. If two specs require editing the same file, they must be sequential
(wave N → wave N+1), or one task must be split differently.

**DAG over list.** Tasks form a directed acyclic graph, not a flat list.
Parallelism comes from the graph structure: nodes with no shared dependencies
can execute in the same wave. The DAG makes parallelism explicit and verifiable.

**Inline everything.** Each task file bundles:
- Its spec (full inline copy from the specs/ directory)
- Relevant design excerpts (only the parts that task needs — schema, conventions)
- Project rules (boundaries, conventions from AGENTS.md or equivalent)
- Dependency info (which task's output is this task's input)
- Output declaration (what files/artifacts this task produces)

This duplication is intentional — it buys context isolation. Token cost of
duplication is cheaper than the coordination cost of shared references.

**3-5 tasks per wave is the sweet spot.** Anthropic's research and the
Totalum 2026 playbook both find this range optimal. More than 5 concurrent
subagents and the orchestrator spends more time merging than it saves.

## Prerequisites

Before starting, verify:
1. Implementation specs exist at `.plan/<DD-MM-YYYY>/<name>/specs/*.md`
2. Design doc exists at `.plan/<DD-MM-YYYY>/<name>/design.md` (for excerpts)
3. Project root has conventions file (AGENTS.md, CLAUDE.md, or equivalent)

## Workflow

### Phase 1: Analyze Dependencies

1. Read all spec files from `.plan/<DD-MM-YYYY>/<name>/specs/`.
2. For each spec, identify:
   - What files it creates or edits
   - What existing files it reads
   - What artifacts it produces that other specs might depend on
3. Build the dependency graph:
   - Spec A depends on Spec B if A needs files or artifacts B produces
   - Two specs are independent if they touch disjoint files AND neither
     needs the other's output

### Phase 2: Assign Waves

4. Apply topological sort to the DAG to determine execution waves.
5. Wave 1 = all tasks with zero incoming dependencies.
6. Wave N = all tasks whose dependencies are fully satisfied by waves 1..N-1.
7. Validate: no two tasks in the same wave share a write target file.
   If they do, split or sequentialize.

### Phase 3: Build Task Files

For each task in the DAG:

8. Load `assets/task-template.md` for structure.
9. Fill every section:
   - **Dependency**: list predecessor task IDs + exact files/artifacts needed
   - **Output**: exact files and test commands this task produces
   - **Spec**: copy the full spec inline — do not reference, do not link
   - **Design Excerpts**: extract only relevant parts from design.md:
     - Data model tables/columns this task touches
     - API conventions (response format, error format, auth mechanism)
     - Tech stack versions this task uses
   - **Project Rules**: inline the relevant boundaries from the project's
     conventions file (Always / Ask / Never)
   - **Verification**: exact command that proves this task is done

10. Each task file must pass the self-containment test: "Can a subagent with
    ONLY this file implement the task correctly?"

### Phase 4: Write Manifest

11. Load `assets/manifest-template.md` for structure.
12. Fill the manifest with:
    - **Execution Order**: ASCII art showing wave structure and parallelism
    - **Wave Breakdown**: per-wave tables — task IDs, slugs, worktree paths,
      dependencies, verification commands. Each wave explicitly marks which
      tasks run in parallel.
    - **File write map**: per-wave table showing which task writes which files,
      proving zero conflicts within the wave.
    - **Dependency Graph**: ASCII art DAG showing all dependency edges.
    - **Task Inventory**: master table with every task's wave, worktree path,
      branch name, and task file path. This is the machine-readable index
      that the `execute` skill reads to dispatch workers.
    - **Execution Status**: status table pre-filled with ⬜ pending. The
      `execute` skill updates this table as tasks progress.

### Phase 5: Validate

12. Cross-task validation:
    - No missing dependency edges
    - No cycles in the DAG
    - No file write conflicts within any wave
    - Every spec from specs/ is covered by exactly one task
    - Every task passes the self-containment test

13. Present the manifest and ask for user confirmation.

## Document Output

### Directory Structure

```
.plan/<DD-MM-YYYY>/<name>/tasks/
├── manifest.md            # DAG + waves + execution overview
├── task-{{id}}-{{slug}}.md  # Self-contained task file
├── task-{{id}}-{{slug}}.md
└── ...
```

No `shared/` directory. Every task file is self-contained.

### Template

Load `assets/task-template.md` for each task file. The template uses
`{{placeholder}}` tokens. Fill completely — no blanks, no references
to external files.

## Gotchas

- **Duplication is a feature, not a bug.** Copying the same schema excerpt
  into 4 task files costs tokens but buys perfect isolation. The subagent
  never context-switches to find information. This is the right trade-off
  for worktree-based execution.
- **File conflicts are the #1 failure mode.** Two subagents editing the
  same file in parallel = guaranteed merge conflict. The DAG must prevent
  this. Check every file write assignment before finalizing waves.
- **"Read" doesn't mean "read the file."** When a task says "READ:
  src/models/user.py" in its file ownership, the subagent should read it
  from the ACTUAL repository during execution — not from the task file.
  Design excerpts in the task file are supplementary context, not
  replacement for reading the real code.
- **Don't over-decompose.** Each task should be a meaningful unit of work
  (15-30 min for a subagent). Splitting a 15-min task into three 5-min
  tasks adds orchestration overhead with no parallelism gain.
- **Task files are the artifact, not the manifest.** The manifest is an
  index for the human orchestrator. The task files are what subagents
  actually read. Spend effort on task file quality, not manifest polish.
- **Verification must be self-contained too.** The command in the task
  file must work from a clean checkout of the worktree. If it requires
  pre-existing state (database, env vars), document that in the task file.

## References

- `assets/task-template.md` — Self-contained task file structure with
  `{{placeholder}}` tokens. Load during Phase 3 for each task.
- `assets/manifest-template.md` — Structured manifest with wave ordering,
  parallelism declaration, worktree paths, and execution status table.
  Load during Phase 4.
