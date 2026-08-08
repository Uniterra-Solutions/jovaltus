# Testing — Jovaltus

Test framework, commands, conventions, and layout.

## Framework

| Component | Value |
|-----------|-------|
| Framework | pytest >=8 |
| Runner | `uv run pytest` |
| Config | `pyproject.toml` `[tool.pytest.ini_options]` |
| Coverage | Not configured (no `--cov`) |
| Python path | `pythonpath = ["src"]` (in pyproject.toml) |

## Commands

```bash
uv run pytest -v                          # Full suite (143 tests)
uv run pytest -v tests/test_state.py      # Single file
uv run pytest -v -k "test_verdict"        # Single test
uv run pytest -v --ignore=tests/integration  # Unit tests only (no Docker CLI tests)
```

## Test Directory Layout

```
tests/
├── conftest.py              # Shared fixtures (git_repo, clear_task_state)
├── __init__.py
├── test_state.py            # 29 tests — state machine transitions + cross-session resume
├── test_tools.py            # 27 tests — 4 tool handlers + dispatch
├── test_hooks.py            # 35 tests — hook callbacks + chain advancement + completion notification
├── test_register.py         # 5 tests — registration wiring (4 tools + 4 hooks)
├── test_git_utils.py        # 19 tests — git operations via fabricium
├── test_sync.py             # 8 tests — state persistence + skill sync
├── test_setup_config.py     # 12 tests — YAML editor + HermesPlugin auto-config wiring
└── integration/
    ├── conftest.py          # Integration fixtures
    └── test_cli.py          # 8 tests — CLI (setup, status, update)
```

There is **no `tests/evals/`** in v1.0.0 — the eval harness measured skill
lift for the removed pipeline skills. Its role as the behavioral gate is
taken over by the Phase 7 Docker E2E verification (below).

## Fixture Patterns

### `clear_task_state` (autouse, `tests/conftest.py`)

Resets in-memory state before every test. Runs automatically via `autouse=True`.

### `git_repo` (function-scoped, `tests/conftest.py`)

Creates a temporary git repo with an initial commit. Uses `tmp_path` — each test
gets an isolated repo. Configures git user + email for commit.

### Fake ctx (tool/hook/register tests)

`test_tools.py`, `test_hooks.py`, and `test_register.py` drive handlers and
hook callbacks with a fake ctx object that records
`register_tool` / `register_hook` / `subagent_lifecycle` calls — no live Hermes
runtime or LLM is needed.

## Fixture Usage

```python
def test_something(git_repo):
    # git_repo is a Path to an initialized git repo with one commit
    from fabricium.git_utils import get_head_hash
    assert get_head_hash(str(git_repo)) is not None
```

## Mock Policy

No mocking by default. Tests use real git repos (`tmp_path`) and real subprocess
calls. The `git_repo` fixture provides real git repos in temp directories.
State-machine tests monkeypatch `fabricium.state._get_global_hermes_home` to a
tmp dir to simulate cross-session resume without touching the real
`~/.hermes/jovaltus_state.json`.

## Behavioral Gate: Phase 7 Docker E2E

The eval harness was removed in v1.0.0. The behavioral gate is a **Docker
E2E verification** run by the orchestrator after the local suite passes.
It verifies the plugin's live behavior inside a real Hermes container:

1. **Temp HERMES_HOME:** copy `~/.hermes/config.yaml` + `~/.hermes/.env`
   into a fresh `<tmp>/.hermes/`.
2. **Derived image** (base pins uv `exclude-newer`; relax it + install
   fabricium):
   ```dockerfile
   FROM <hermes-agent-base-image>
   ENV UV_EXCLUDE_NEWER=2099-01-01
   RUN uv pip install --python /opt/hermes/.venv/bin/python fabricium
   ```
3. **Long-running container** with the temp HERMES_HOME mounted at
   `/opt/data` and `HERMES_HOME=/opt/data`.
4. **Install the plugin** inside the container (pip entry point or copy into
   `/opt/data/plugins/` + `hermes plugins enable jovaltus`).
5. **Verify agent behavior** (`docker exec jovaltus-e2e hermes chat -q "<prompt>"`):
   - `hermes plugins list` → `jovaltus` enabled
   - `hermes jovaltus status` → exit 0
   - A prompt that triggers a plugin tool, e.g.
     `docker exec jovaltus-e2e hermes chat -q "call the plan tool with user_requirements='build a hello world CLI'"`
     → exit code 0, no plugin traceback. Assert on side effects + exit code,
     NOT exact LLM text (non-deterministic output):
     - plan tool spawns a subagent: `subagent_start`/`subagent_stop` hooks fire
     - state file written: `/opt/data/jovaltus_state.json` contains a
       `"pipeline"` key with `tool=plan`
     - `pre_llm_call` injection: pipeline status visible in a follow-up turn
6. **Cleanup:** `docker rm -f jovaltus-e2e`, `docker rmi jovaltus-e2e`,
   remove the temp HERMES_HOME, `docker builder prune -a -f` (keep base image).

## CI / Pre-commit

Pre-commit hooks (`pre-commit run --all-files`):
1. `ruff check` — lint (blocks on failure)
2. `mypy --strict` — type check (blocks on failure)
3. `ruff format` — auto-formats after checks pass

## Test File Naming

| Pattern | Example |
|---------|---------|
| Unit tests | `test_<module>.py` |
| Integration tests | `test_<feature>.py` in `tests/integration/` |
| Shared fixtures | `conftest.py` at each level |

## Conventions

- `autouse=True` fixture resets state before each test
- `git_repo` fixture provides isolated repos
- No mocking — tests exercise real code paths (fake ctx only for tool/hook/register)
- Test functions are short and focused on one behaviour
- Integration tests use their own `conftest.py`

## How to Update

- New test file added? → Add to Test Directory Layout
- Test framework/runner changed? → Update Framework table
- New fixture added? → Add to Fixture Patterns

## Find It Fast

```bash
ls tests/                                    # Test directory structure
grep -rn 'def test_' tests/                  # All test functions
grep -rn '@pytest.fixture' tests/conftest.py # All fixtures
```
