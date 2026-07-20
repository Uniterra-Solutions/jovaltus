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
uv run pytest -v                          # Full suite (39 tests)
uv run pytest -v tests/test_git_utils.py  # Single file
uv run pytest -v -k "test_get_diff"       # Single test
uv run pytest -v --ignore=tests/evals     # Skip eval tests (no Docker/API needed)
```

## Test Directory Layout

```
tests/
├── conftest.py              # Shared fixtures (git_repo, clear_task_state)
├── __init__.py
├── test_git_utils.py        # 18 tests — git operations via fabricium
├── test_sync.py             # 8 tests — state persistence + skill sync
├── integration/
│   ├── conftest.py          # Integration fixtures
│   └── test_cli.py          # 8 tests — CLI (setup, status, update)
└── evals/
    ├── conftest.py          # Eval harness fixtures (Docker + LLM APIs)
    ├── __init__.py
    ├── test_jovaltus_skills.py  # 4 tests — end-to-end pipeline eval
    ├── tasks.py             # Eval task definitions
    └── rubrics.py           # Eval scoring rubrics
```

## Fixture Patterns

### `clear_task_state` (autouse, `tests/conftest.py`)

Resets in-memory state before every test. Runs automatically via `autouse=True`.

### `git_repo` (function-scoped, `tests/conftest.py`)

Creates a temporary git repo with an initial commit. Uses `tmp_path` — each test
gets an isolated repo. Configures git user + email for commit.

### `eval_harness` (session-scoped, `tests/evals/conftest.py`)

Docker-based harness for pipeline evaluation. Requires LLM API keys.
Creates profiles: `bare` (no Jovaltus) and `jovaltus-agent` (with Jovaltus).

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

## Eval Tests

| File | Purpose |
|------|---------|
| `tests/evals/tasks.py` | Defines eval scenarios (requirements → expected outcome) |
| `tests/evals/rubrics.py` | Defines scoring criteria for judging results |
| `tests/evals/test_jovaltus_skills.py` | Runs pipeline end-to-end in Docker container |

Eval tests require:
- Docker installed and running
- LLM API keys in environment variables
- `fabricium.evals.SkillEvalHarness`

Run with: `uv run pytest tests/evals/ -v -s` (slow, API-dependent)

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
| Eval tests | `test_jovaltus_<aspect>.py` in `tests/evals/` |
| Shared fixtures | `conftest.py` at each level |

## Conventions

- `autouse=True` fixture resets state before each test
- `git_repo` fixture provides isolated repos
- No mocking — tests exercise real code paths
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
