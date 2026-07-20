---
name: to-environment
description: >
  Creates isolated git worktrees for each task in the manifest, with
  sparse-checkout scoped to only the files that task needs. For brownfield
  projects, performs blast-radius analysis to include all affected files.
  Each worktree is a fully self-contained environment ready for a subagent
  to execute its task file. Produces worktrees under .worktrees/.
  LOAD when:
  - Task manifest exists at .plan/<date>/<name>/tasks/manifest.md
  - User says "setup worktrees" or "create environments" or "to-environment"
  - Ready to spawn parallel subagents from the task manifest
  Do NOT use for:
  - Creating tasks or specs (use to-spec, to-tasks)
  - Running subagents directly — this only creates the environments
  - Single-branch sequential work
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [worktree, environment, isolation, parallel, sparse-checkout]
---

# To Environment

## Goal

Create one isolated git worktree per task in the manifest. Each worktree
contains only the files that task needs — zero unrelated noise. For
brownfield projects, this includes blast-radius analysis to pull in every
file affected by the planned changes.

The output is a set of worktrees under `.worktrees/`, each ready for a
subagent to check out, read its task file, and start implementing.

## Acceptance Criteria

- One worktree per task in the manifest, each on its own branch
- Sparse-checkout scoped to exactly the files that task needs:
  - Files the task creates or edits (from task spec)
  - All files affected by those changes (blast radius — brownfield only)
  - The task file itself
  - Project config files needed for the verification command to work
- Zero file-write conflicts within any wave (enforced by task manifest)
- Each worktree passes the self-containment test: a subagent dropped into
  the worktree can run the verification command without missing dependencies
- Worktrees for the same wave can be used in parallel safely

## Core Principles

**Minimal surface area.** The worktree contains exactly what the task needs
and nothing else. This reduces token consumption (subagent sees fewer files),
prevents accidental edits to unrelated code, and makes git operations faster.

**Blast radius, not guesswork.** For brownfield projects, don't manually list
files. Use dependency analysis to find the blast radius: every file that
imports or is imported by the changed files, transitively, plus associated
test files. If a changed file touches `src/auth/login.py`, the blast radius
includes every file that imports from `src.auth.login` — because those files
may break if the interface changes.

**One branch per task.** Each worktree gets its own branch named
`agent/<wave>-<task-id>-<slug>`. This isolates commits, makes review trivial
(one PR per task), and enables clean teardown (delete the branch + worktree).

**Worktrees are disposable.** If a subagent produces bad output, delete the
worktree and the branch — nothing else is affected. If a subagent succeeds,
merge the branch. Worktrees are cheap because they share the `.git` object
store.

**Config files are shared context.** The worktree needs project config files
(`pyproject.toml`, `package.json`, `tsconfig.json`, `.env.example`, etc.) for
the verification command to work. These are read-only for the subagent.

## Prerequisites

1. Task manifest exists at `.plan/<DD-MM-YYYY>/<name>/tasks/manifest.md`
2. Task files exist at `.plan/<DD-MM-YYYY>/<name>/tasks/task-*.md`
3. Project is a git repository with a clean or committed working tree

## Workflow

### Phase 1: Read the Manifest

1. Parse `manifest.md` to extract:
   - Task IDs, slugs, wave assignments
   - Per-task file ownership: CREATE, EDIT, READ paths
   - Dependency edges (which task produces input for which)
   - Verification commands per task

### Phase 2: Determine File Sets

For each task, build the sparse-checkout file set:

2. **Always include:**
   - The task file: `.plan/<DD-MM-YYYY>/<name>/tasks/task-<id>-<slug>.md`
   - Project config files needed for the verification command:
     - Python: `pyproject.toml`, `setup.cfg`, `tox.ini`, `.env.example`
     - Node: `package.json`, `tsconfig.json`, `.env.example`
     - Go: `go.mod`, `go.sum`
     - Generic: `.gitignore`, `Makefile`, any lock files
   - Directory-level includes for `CREATE` paths (e.g. `src/auth/`)

3. **Files to EDIT:** (from task spec)
   - Add each file's exact path

4. **Blast radius — Brownfield only:**
   - For each EDIT file, find ALL files that depend on it.
   - Method A (preferred): Use a dependency analysis tool if available
     (`rg` / `grep` for imports, or dedicated tool)
   - Method B (fallback): Manual grep-based analysis
   - Include direct dependents + transitive dependents + associated test files
   - Include shared utilities/types/configs that the EDIT files import

5. **Greenfield shortcut:**
   - If no EDIT files (all CREATE), include the directory trees for created
     files + config files + task file. No blast radius needed.

### Phase 3: Create Worktrees

For each task, ordered by wave:

6. **Create the worktree:**
   ```bash
   git worktree add .worktrees/<wave>-<task-id>-<slug> -b agent/<wave>-<task-id>-<slug>
   ```

7. **Enable sparse-checkout:**
   ```bash
   cd .worktrees/<wave>-<task-id>-<slug>
   git sparse-checkout init --cone
   ```

8. **Set sparse paths** — directory-level patterns:
   ```bash
   git sparse-checkout set <dirs>
   ```
   Use cone mode: only directory patterns. List the parent directories of all
   files in the set. For example, if files are `src/auth/login.py` and
   `tests/auth/test_login.py`, the patterns are `src/auth` and `tests/auth`.

9. **Add individual files outside the cone:**
   If a file needs to be included but its parent directory contains files
   that should NOT be included, switch to non-cone mode or add it as a
   specific file pattern. However, cone mode is strongly preferred for
   performance.

### Phase 4: Place Task Files

10. Copy each task's `.md` file into its worktree root:
    ```bash
    cp .plan/<date>/<name>/tasks/task-<id>-<slug>.md \
       .worktrees/<wave>-<task-id>-<slug>/TASK.md
    ```
    The file is named `TASK.md` in the worktree root so the subagent finds
    it immediately.

### Phase 5: Validate

11. For each worktree, run a smoke test:
    - Verify the task file is present and readable
    - Verify all EDIT files from the task spec exist in the worktree
    - Verify config files needed for the verification command exist
    - Verify that files from other tasks in the SAME wave are NOT present
      (no cross-contamination within a wave)

12. Present a summary to the user:
    ```
    ## Worktrees Created
    
    Wave 1 (can run in parallel):
    .worktrees/1-t1-register/  → branch agent/1-t1-register  (8 files)
    .worktrees/1-t2-login/     → branch agent/1-t2-login     (6 files)
    
    Wave 2 (after Wave 1):
    .worktrees/2-t3-verify/    → branch agent/2-t3-verify    (5 files)
    .worktrees/2-t4-session/   → branch agent/2-t4-session   (7 files)
    
    To start a subagent: cd .worktrees/<dir> && <agent-command>
    ```

## Blast Radius Analysis

### Method A: Dependency-Aware (Recommended for JS/TS/Python)

For Python projects, use `rg` (ripgrep) to find import relationships:

```bash
# Find files that import from the changed module
rg "from src\.auth\.login import|import src\.auth\.login" --files-with-matches

# Find files that the changed file imports (forward dependencies)
rg "^from|^import" src/auth/login.py
```

For JavaScript/TypeScript:
```bash
# Find files that import from the changed file
rg "from ['\"].*login['\"]|require\(.*login" --files-with-matches

# Find files the changed file imports
rg "^import|^const.*require" src/auth/login.ts
```

### Method B: Dedicated Tools

If installed in the project, use:
- `blast-radius` (npm) for JS/TS: `npx blast-radius file <path>`
- `codegraph` (npm): `npx codegraph deps <path>`
- `constrictor` (pip) for Python: `constrictor impact --node <module>`

### Rules for Inclusion

| File type | Include? | Reason |
|-----------|----------|--------|
| Direct dependent (imports changed file) | YES | May break if interface changes |
| Transitive dependent | YES | May break if behavior changes |
| Test file for changed code | YES | Must pass after changes |
| Test file for dependent | YES | Must pass after changes |
| Unrelated file in same directory | NO | Noise — don't include |
| Generated file (dist/, build/) | NO | Regenerated, not edited |
| Vendor/dependency file | NO | Not project code |

## Document Output

### Directory Structure

```
.worktrees/
├── <wave>-<task-id>-<slug>/
│   ├── TASK.md           ← task file (copied)
│   ├── src/...           ← sparse-checkout source files
│   ├── tests/...         ← sparse-checkout test files
│   └── pyproject.toml    ← project config
├── <wave>-<task-id>-<slug>/
│   └── ...
└── ...
```

No other output files. The worktrees are the deliverable.

## Gotchas

- **Sparse-checkout cone mode only accepts directories.** If you need a
  single file from a directory with many unrelated files, either accept
  the extra files or switch to non-cone mode. In practice, including the
  parent directory is usually fine — the token cost of a few extra files
  is negligible compared to the cost of non-cone mode setup.
- **Worktree cleanup.** After subagents finish, remove worktrees with
  `git worktree remove .worktrees/<dir>`. Orphaned worktree metadata is
  cleaned with `git worktree prune`.
- **Branch name conflicts.** Two tasks in the same wave get different
  branch names (`agent/1-t1-*`, `agent/1-t2-*`). Never reuse branch names.
- **Config files enable the verification command.** If the task's
  verification command is `pytest tests/auth/test_login.py -v`, the worktree
  needs `pyproject.toml` (for pytest config) and `conftest.py` files.
  Always include the minimal set of config files for the verification
  command to work.
- **Don't include `.git` in sparse-checkout considerations.** The `.git`
  directory is always present in a worktree (it's a link to the main repo's
  `.git/worktrees/<id>/`). Sparse-checkout only affects the working tree.
- **Blast radius tools are optional.** `rg` with well-crafted import patterns
  is sufficient for most projects. Only recommend dedicated tools if the
  project already has them or the codebase is very large (>10K files).

## References

- `assets/worktree-config.md` — Detailed git worktree + sparse-checkout
  command reference. Load on demand when the agent needs exact syntax.
