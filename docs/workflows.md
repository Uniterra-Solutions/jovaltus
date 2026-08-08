# Workflows — Jovaltus

Step-by-step recipes for common development tasks.

## Adding a Bundled Skill

1. Create directory `src/jovaltus/skills/<skill-name>/`
2. Write `SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: <skill-name>
   description: >-
     ... (must include LOAD/Do NOT use triggers)
   ---
   ```
3. Add supporting files under `references/`, `assets/`, `templates/` as needed
4. Fabricium auto-discovers skills — no manual registration required
5. Add tests if the skill introduces new CLI or sync behavior
6. Update `docs/architecture.md` Bundled Skills table

## Running a Tool-Driven Pipeline

The 4 tools (`plan`, `execute`, `simplify`, `review`) are registered with
toolset `jovaltus` (`src/jovaltus/tools.py:85-140`). Each call starts a
deterministic pipeline whose phases advance automatically via the
`subagent_stop` hook — the main agent does not drive the chain.

### 1. `plan` — build the task DAG

Call the `plan` tool with `user_requirements` (required string). It
computes the run dir `<repo_root>/.plan/<YYYYmmdd>/<plan_name>/` and dispatches
subagents in sequence: prd → research → acceptance → tasks
(`src/jovaltus/tools.py:163-171`). Each subagent writes its artifact into the
run dir:

```
.plan/<YYYYmmdd>/<plan_name>/
├── prd.md          # PRD subagent output
├── design.md       # research subagent output
├── acceptance.md   # acceptance criteria subagent output
└── tasks.md        # task DAG manifest (serial / batch / fully-parallel forms + mermaid DAG)
```

When the chain finishes, `status_text` reports
`plan complete: <run_dir>/tasks.md` (`src/jovaltus/state.py:279-292`) and
`pre_llm_call` injects that line into the next turn.

### 2. `execute` — implement the DAG

Call the `execute` tool with `plan` = path to a `tasks.md` manifest
(required; the file must exist). **Precondition:** the host Hermes config
must have `delegation.max_spawn_depth >= 2` (the execute orchestrator is a
depth-1 child that spawns its own workers). The handler checks the
effective value and returns
`{"status":"error","message":"execute requires delegation.max_spawn_depth >= 2"}`
otherwise (`src/jovaltus/tools.py:428-443`, `562-571`). `hermes jovaltus
setup` and `hermes jovaltus update` auto-configure the floor for installed
profiles (`src/jovaltus/setup_config.py`), so the manual step below is only
needed for profiles outside the plugin's setup/update flow:

```bash
# set once in the Hermes config if setup/update did not run
hermes config set delegation.max_spawn_depth 2
```

The execute orchestrator reads the task DAG and drives every task level by
level — same-level tasks in parallel. It must NOT commit: the diff is left
in the working tree for simplify/review (`src/jovaltus/prompts/execute.md`).

### 3. `simplify` — simplify the changes

Call the `simplify` tool with `plan` = path to the plan directory (the
handler resolves the parent of the manifest). It dispatches a
simplification-review subagent; if the reviewer writes
`verdict.json` `{"verdict":"fix",...}`, the pipeline parks in
`simplify_waiting` and **you (the main agent) apply the suggestions**
— no fixer subagent is dispatched. When your fixing turn ends, the
`post_llm_call` hook re-dispatches the reviewer automatically. Loop until
the verdict is `"pass"` (no iteration cap — `src/jovaltus/hooks.py:167-206`).

### 4. `review` — adversarially review the changes

Call the `review` tool with `plan` = path to the plan directory. Same loop
shape as simplify, but the reviewer tries to BREAK the changes (bugs,
assumptions, edge cases) instead of seeking simplification. A `"fix"`
verdict parks in `review_waiting`; you fix, and `post_llm_call`
re-dispatches the reviewer.

### Loop mechanics (shared)

- Every dispatched child's goal carries the marker
  `[jovaltus-pipeline:<tool>:<phase>]`; `subagent_start` associates the
  child with the pipeline (`src/jovaltus/hooks.py:49-77`).
- `subagent_stop` advances the chain when the active child completes
  (`src/jovaltus/hooks.py:79-106`). A `"fix"` verdict parks the pipeline and
  pushes a fix-request event (`_push_fix_request_event`,
  `src/jovaltus/hooks.py:303-320`) that wakes you with the findings.
- `pre_llm_call` injects a status line each turn while a pipeline exists
  (`src/jovaltus/hooks.py:108-122`), so you always see the current
  tool/phase/status/run_dir.
- `post_llm_call` re-dispatches the reviewer after your fixing turn ends
  (`src/jovaltus/hooks.py:124-165`). It is a no-op unless the pipeline is
  parked in `*_waiting` and the turn belongs to the owning session, so it
  does not fire outside the loop.

## Running Tests During Development

```bash
# Full suite (143 tests)
uv run pytest -v

# Unit tests only (no integration)
uv run pytest tests/ -v --ignore=tests/integration

# Single file / single test
uv run pytest -v tests/test_state.py
uv run pytest -v -k "test_pipeline_transitions"

# Lint, format, and type gates (must all pass before commit)
uv run ruff check .
uv run ruff format --check .
uv run mypy
```

## Pre-commit Workflow

```bash
# Run all hooks manually
pre-commit run --all-files

# Run a specific hook
pre-commit run ruff --all-files
pre-commit run mypy --all-files

# Skip hooks (emergency only)
git commit --no-verify -m "..."
```

## Updating Plugin Version

1. Bump version in `pyproject.toml` `[project] version`
2. Bump version in `src/jovaltus/plugin.yaml` `version`
3. Add a `## v<version>` entry at the top of `CHANGELOG.md`
   (Keep a Changelog format)
4. Update `docs/` + root `README.md` if the release changes behavior
5. Tag: `git tag v<version> && git push --tags` (triggers PyPI trusted publisher)

## Editing a Skill

1. Edit `src/jovaltus/skills/<name>/SKILL.md`
2. Restart Hermes to reload skills (or use `skill_view()` which reads from disk)
3. Test with a small task to verify behavior
4. Keep root `README.md` and `docs/` in sync if the change alters the skill's
   description, workflow, or output contracts

## Creating a Branch + PR from Changes

Use the `manage-git-repo` skill to create branches, commit, and open PRs:

- **Workflow C (single PR):** For changes with ≤ 3 commits that fit in one reviewable PR.
  Load `manage-git-repo` skill and follow Workflow C steps (C.1–C.7) to create a semantic
  branch, batch-commit, and open a single pull request.

- **Workflow D (stacked PR):** For multi-commit changes (4+ commits, or 2–3 distinct layers).
  Load `manage-git-repo` skill and follow Workflow D steps (D.1–D.8) to create a stack of
  dependent PRs via `gh stack`. Each commit becomes its own reviewable layer; the whole
  stack merges in one click.

Workflow C example:
1. Load `manage-git-repo` skill
2. Follow Workflow C steps:
   - C.1: Pre-flight (auth, index, base branch)
   - C.2: Determine branch name from changed files (`feat/slug`, `fix/slug`, etc.)
   - C.3: `git checkout -b <branch-name>`
   - C.4: Batch-commit using Workflow A's dependency order
   - C.5: `git push -u origin HEAD`
   - C.6: Create PR via `gh pr create` (or curl fallback)
3. PR body is derived from commit messages — ensure commits tell a clear story

Workflow D example:
1. Load `manage-git-repo` skill
2. Run Workflow A first to categorize and commit changes
3. Follow Workflow D steps:
   - D.1: Verify `gh stack` extension installed
   - D.2: Classify commits into stack layers
   - D.3: `gh stack init <first-branch>`
   - D.4: `gh stack add <branch>` + `git cherry-pick <hash>` for each layer
   - D.5: `gh stack view` to verify
   - D.6: `gh stack push` + `gh stack submit`
4. Merge with `gh stack merge --yes --squash` when reviews are approved

## Debugging a Pipeline Run

1. Check the status line injected by `pre_llm_call` each turn —
   `[Jovaltus pipeline] tool=<tool> phase=<phase> status=<status> run_dir=<abs>`
2. Inspect the persisted state: `cat ~/.hermes/jovaltus_state.json`
   (pipeline data under the `"pipeline"` key)
3. Inspect run artifacts: `ls .plan/<YYYYmmdd>/<plan_name>/`
4. For simplify/review verdict issues, check `verdict.json` in the run dir
5. Check subagent output in the terminal tab (if using Hermes TUI)
6. For the Docker E2E gate: check container logs (`docker exec jovaltus-e2e ...`)

## How to Update

- New workflow added? → Add recipe following the pattern above
- Existing workflow changed? → Update the recipe
- Command syntax changed? → Update all recipes referencing it

## Find It Fast

```bash
ls src/jovaltus/                             # Plugin source modules
cat src/jovaltus/tools.py                    # 4 tool handlers + CHAIN
cat src/jovaltus/hooks.py                    # 3 hook callbacks
ls src/jovaltus/skills/                      # All skills
grep -rn '^name:' src/jovaltus/skills/*/SKILL.md  # Skill names
```
