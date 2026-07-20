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
   author: LaiTszKin
   version: 0.1.0
   metadata:
     jovaltus:
       tags: [...]
   ---
   ```
3. Add supporting files under `references/`, `assets/`, `templates/` as needed
4. Fabricium auto-discovers skills — no manual registration required
5. Add tests if the skill introduces new CLI or sync behavior
6. Update `docs/architecture.md` Phase Details table

## Running the Full Pipeline

1. Start Hermes: `hermes -p jovaltus-agent`
2. Load `discuss` skill → elicit requirements → produce `prd.md`
3. Load `design` skill → challenge every decision → produce `design.md`
4. Load `to-spec` skill → translate to implementation specs
5. Load `to-tasks` skill → decompose into flat, independent tasks
6. Load `to-environment` skill → create isolated worktrees
7. Load `execute` skill → dispatch subagents in parallel
8. Load `review` skill → adversarial review per worktree → merge
9. Load `qa` skill → PRD-driven acceptance testing

## Running Tests During Development

```bash
# Quick: unit tests only (no integration, no evals)
uv run pytest tests/ -v --ignore=tests/integration --ignore=tests/evals

# Unit + integration (no Docker needed)
uv run pytest -v --ignore=tests/evals

# Eval tests (need Docker + API keys)
EVAL_CANDIDATE_PROVIDER=deepseek \
EVAL_CANDIDATE_MODEL=deepseek/deepseek-chat \
EVAL_CANDIDATE_API_KEY=$DEEPSEEK_KEY \
EVAL_JUDGE_PROVIDER=anthropic \
EVAL_JUDGE_MODEL=anthropic/claude-sonnet-4 \
EVAL_JUDGE_API_KEY=$ANTHROPIC_KEY \
uv run pytest tests/evals/ -v -s
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
3. If skills changed, bump their version in respective `SKILL.md` files
4. Update `CHANGELOG.md`
5. Tag: `git tag v<version> && git push --tags` (triggers PyPI trusted publisher)

## Editing a Skill

1. Edit `src/jovaltus/skills/<name>/SKILL.md`
2. Restart Hermes to reload skills (or use `skill_view()` which reads from disk)
3. Test with a small task to verify behavior

## Debugging a Subagent

1. Check the worktree log: `git -C .worktrees/<task>/ log --oneline`
2. Check subagent output in the terminal tab (if using Hermes TUI)
3. For eval tests: check Docker container logs

## How to Update

- New workflow added? → Add recipe following the pattern above
- Existing workflow changed? → Update the recipe
- Command syntax changed? → Update all recipes referencing it

## Find It Fast

```bash
ls src/jovaltus/skills/                              # All skills
grep -rn '^name:' src/jovaltus/skills/*/SKILL.md       # Skill names
cat src/jovaltus/__init__.py                           # Plugin entry (55 lines)
```
