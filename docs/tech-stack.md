# Tech Stack — Jovaltus

| Component | Version | Category | Purpose |
|-----------|---------|----------|---------|
| Python | >=3.10 | Runtime | Plugin host language |
| fabricium | >=0.1.1 | Framework | Hermes plugin SDK — `HermesPlugin`, `git_utils`, `state` |
| hatchling | (build-system) | Build | PEP 621 wheel builder |
| pytest | >=8 | Testing | Test framework, 102 tests |
| ruff | >=0.8 | Lint/Format | Linting + auto-formatting |
| mypy | >=1.16 | Type Check | Strict type checking (`--strict`, zero errors) |
| pre-commit | (hooks) | CI/CD | Git hooks: ruff check → mypy → ruff format |

## Key Runtime Dep

| Dependency | Purpose |
|------------|---------|
| `fabricium.HermesPlugin` | Plugin registration: CLI commands, bundled skills |
| `fabricium.git_utils` | Git operations: diff, hash, status, stats |
| `fabricium.state` | `load_state` / `save_state` — JSON persistence of pipeline state (`~/.hermes/jovaltus_state.json`) |

The plugin is built entirely on Hermes APIs available in the runtime:
`ctx.register_tool` / `ctx.register_hook` / `ctx.subagent_lifecycle.launch`
(dispatch pipeline subagents; the parent is resolved from the main-agent
turn and cached for hook-driven continuation) and the `subagent_start` /
`subagent_stop` / `pre_llm_call` hooks. No new dependencies beyond
`fabricium>=0.1.1`.

## Behavioral Verification (no eval harness)

v1.0.0 removed the Docker-based `SkillEvalHarness` eval suite. The behavioral
gate is a **Phase 7 Docker E2E** run against a real Hermes container
(`docker exec <container> hermes chat -q "<prompt>"`) — see
[testing.md](testing.md).

## No Database / No HTTP Server

Jovaltus is a CLI plugin, not a web service. No database, no cache, no HTTP routes.
Pipeline state is a local JSON file managed by `fabricium.state`.

## How to Update

- Dependency added/removed? → Update the table and verify `pyproject.toml`
- Version bumped? → Match `pyproject.toml` `version` field and lockfile

## Find It Fast

```bash
grep -E '^requires-python|^dependencies' pyproject.toml   # Runtime requirements
grep 'dev =' pyproject.toml                                 # Dev dependencies
grep -rn 'from fabricium' src/                              # All fabricium usage
```
