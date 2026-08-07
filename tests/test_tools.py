"""Unit tests for the Jovaltus tool handlers (Contract §1, §5).

Uses a fake ctx whose ``subagent_lifecycle`` records ``launch`` requests and
returns a configurable handle, and monkeypatches fabricium state persistence
into a tmp dir (mirroring tests/test_sync.py).
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

import fabricium.skills as fskills
import fabricium.state as fstate
from jovaltus import state as jstate
from jovaltus import tools


class FakeHandle:
    """Stub of SubagentHandle: the fields tools.py reads after launch."""

    def __init__(self, subagent_id: str = "sa-1") -> None:
        self.subagent_id = subagent_id
        self.parent_session_id: str | None = None
        self.depth = 1


class FakeLifecycle:
    """Stub of SubagentLifecycleService: records launch requests."""

    def __init__(self) -> None:
        self.launches: list[Any] = []
        self.error: Exception | None = None

    def launch(self, request: Any) -> FakeHandle:
        if self.error is not None:
            raise self.error
        self.launches.append(request)
        return FakeHandle()


class FakeCtx:
    """Minimal ctx stub: records register_tool; lifecycle wired via fixture."""

    def __init__(self) -> None:
        self.tools: list[dict[str, Any]] = []
        self.subagent_lifecycle = FakeLifecycle()

    def register_tool(
        self,
        name: str,
        toolset: str,
        schema: dict[str, Any],
        handler: Any,
        **kwargs: Any,
    ) -> None:
        entry: dict[str, Any] = {
            "name": name,
            "toolset": toolset,
            "schema": schema,
            "handler": handler,
        }
        entry.update(kwargs)
        self.tools.append(entry)


@pytest.fixture
def fake_ctx(fake_home: Path, monkeypatch: pytest.MonkeyPatch) -> FakeCtx:
    ctx = FakeCtx()
    # tools.py dispatches via _get_lifecycle() (module-level) — wire the fake.
    monkeypatch.setattr(tools, "_get_lifecycle", lambda: ctx.subagent_lifecycle)
    tools.register(ctx)
    return ctx


@pytest.fixture
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect fabricium state persistence into a temp dir."""
    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(fskills, "_get_global_hermes_home", lambda: tmp_path)
    return tmp_path


def _clear_terminal_cwd(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove TERMINAL_CWD so tests exercise the cwd() fallback path."""
    monkeypatch.delenv("TERMINAL_CWD", raising=False)


def _today() -> str:
    return datetime.now().strftime("%Y%m%d")


def _expected_run_dir(tmp_path: Path, plan_name: str) -> Path:
    """Expected run dir: <repo_root>/.plan/<YYYYmmdd>/<plan_name>."""
    return tmp_path / ".plan" / _today() / plan_name


def _plan_path(tmp_path: Path, name: str = "tasks.md") -> Path:
    plan = tmp_path / name
    plan.write_text("# tasks\n", encoding="utf-8")
    return plan


def _config_with_depth(tmp_path: Path, depth: int) -> Path:
    cfg = tmp_path / "config.yaml"
    cfg.write_text(f"delegation:\n  max_spawn_depth: {depth}\n", encoding="utf-8")
    return cfg


def _last_launch(fake_ctx: FakeCtx) -> Any:
    assert fake_ctx.subagent_lifecycle.launches, "no launch recorded"
    return fake_ctx.subagent_lifecycle.launches[-1]


# ── plan handler ------------------------------------------------------------


def test_plan_handler_computes_run_dir_and_dispatches(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """plan computes <cwd>/.plan/<date>/<slug> and dispatches the prd phase."""
    monkeypatch.chdir(tmp_path)
    _clear_terminal_cwd(monkeypatch)
    result = json.loads(
        tools.plan_handler({"user_requirements": "Build an app for cats"})
    )
    expected = _expected_run_dir(tmp_path, "build-an-app-for-cats")
    assert result == {
        "status": "started",
        "tool": "plan",
        "phase": "prd",
        "run_dir": str(expected),
        "message": f"plan pipeline started in {expected}; phase prd dispatched",
    }

    args = _last_launch(fake_ctx)
    assert "[jovaltus-pipeline:plan:prd]" in args.goal
    assert "[[run_dir]]" not in args.goal
    assert str(expected) in args.goal
    assert "Build an app for cats" in args.goal
    assert "[[user_requirements]]" not in args.goal
    assert "[[plan_path]]" not in args.goal
    assert "## Repo root" in args.context
    assert str(tmp_path) in args.context
    assert args.role == "leaf"

    p = jstate.get_pipeline()
    assert p is not None
    assert p.tool == "plan"
    assert p.phase == "prd"
    assert p.status == "running"
    assert p.run_dir == str(expected)
    assert expected.is_dir(), "plan handler must create the run directory"


def test_plan_handler_creates_run_dir(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The run directory exists before the first subagent starts."""
    monkeypatch.chdir(tmp_path)
    _clear_terminal_cwd(monkeypatch)
    result = json.loads(tools.plan_handler({"user_requirements": "Build an app"}))
    assert result["status"] == "started"
    assert Path(result["run_dir"]).is_dir()


def test_plan_handler_inherits_terminal_cwd(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The repo root comes from TERMINAL_CWD (main agent's cwd), not cwd().

    Regression: the first Docker E2E runs rooted the pipeline at the plugin
    process's cwd, which diverged from where the main agent actually worked.
    Hermes publishes the main agent's working dir as TERMINAL_CWD
    (delegate_tool.py:874-891).
    """
    repo = tmp_path / "repo"
    repo.mkdir()
    monkeypatch.chdir(tmp_path)  # process cwd differs from the agent's
    monkeypatch.setenv("TERMINAL_CWD", str(repo))
    result = json.loads(tools.plan_handler({"user_requirements": "Build an app"}))
    assert result["status"] == "started"
    assert Path(result["run_dir"]).is_relative_to(repo)
    assert str(repo) in result["run_dir"]


def test_plan_handler_run_dir_suffix(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Same-day same-name runs get a -2/-3 suffix (Contract §5)."""
    monkeypatch.chdir(tmp_path)
    _clear_terminal_cwd(monkeypatch)
    base = tmp_path / ".plan" / _today()

    # First call creates <base>/build-an-app (and the run dir).
    result = json.loads(tools.plan_handler({"user_requirements": "Build an app"}))
    assert result["run_dir"] == str(base / "build-an-app")
    assert (base / "build-an-app").is_dir()

    # Second call sees it exists → -2 (handler also creates it).
    result = json.loads(tools.plan_handler({"user_requirements": "Build an app"}))
    assert result["run_dir"] == str(base / "build-an-app-2")
    assert (base / "build-an-app-2").is_dir()

    # Third call sees both exist → -3.
    result = json.loads(tools.plan_handler({"user_requirements": "Build an app"}))
    assert result["run_dir"] == str(base / "build-an-app-3")


def test_plan_handler_slug_fallback(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Requirements without words fall back to the 'plan' slug."""
    monkeypatch.chdir(tmp_path)
    _clear_terminal_cwd(monkeypatch)
    result = json.loads(tools.plan_handler({"user_requirements": "!!!??? "}))
    assert result["run_dir"] == str(tmp_path / ".plan" / _today() / "plan")


def test_plan_handler_missing_requirements(fake_ctx: FakeCtx, fake_home: Path) -> None:
    result = json.loads(tools.plan_handler({}))
    assert result == {"status": "error", "message": "plan requires user_requirements"}
    assert fake_ctx.subagent_lifecycle.launches == []


def test_plan_handler_dispatch_failure_propagates(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    fake_ctx.subagent_lifecycle.error = RuntimeError("no parent agent")
    result = json.loads(tools.plan_handler({"user_requirements": "Build an app"}))
    assert result["status"] == "error"
    assert "no parent agent" in result["message"]


# ── execute handler ---------------------------------------------------------


def test_execute_handler_dispatches_orchestrator(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """execute dispatches the orchestrator (role) with the given plan path."""
    plan = _plan_path(tmp_path)
    monkeypatch.setattr(tools, "_config_path", lambda: _config_with_depth(tmp_path, 2))
    result = json.loads(tools.execute_handler({"plan": str(plan)}))
    assert result["status"] == "started"
    assert result["tool"] == "execute"
    assert result["phase"] == "execute"
    assert result["run_dir"] == str(tmp_path)

    args = _last_launch(fake_ctx)
    assert "[jovaltus-pipeline:execute:execute]" in args.goal
    assert args.role == "orchestrator"
    assert "[[plan_path]]" not in args.goal
    assert str(plan) in args.goal


def test_execute_handler_missing_plan(fake_ctx: FakeCtx, fake_home: Path) -> None:
    result = json.loads(tools.execute_handler({}))
    assert result == {"status": "error", "message": "execute requires a plan path"}
    assert fake_ctx.subagent_lifecycle.launches == []


def test_execute_handler_nonexistent_plan(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path
) -> None:
    missing = tmp_path / "nope" / "tasks.md"
    result = json.loads(tools.execute_handler({"plan": str(missing)}))
    assert result == {
        "status": "error",
        "message": f"plan path does not exist: {missing}",
    }
    assert fake_ctx.subagent_lifecycle.launches == []


def test_execute_handler_depth_too_low(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """execute refuses when delegation.max_spawn_depth < 2."""
    plan = _plan_path(tmp_path)
    monkeypatch.setattr(tools, "_config_path", lambda: _config_with_depth(tmp_path, 1))
    result = json.loads(tools.execute_handler({"plan": str(plan)}))
    assert result == {
        "status": "error",
        "message": "execute requires delegation.max_spawn_depth >= 2",
    }
    assert fake_ctx.subagent_lifecycle.launches == []


def test_execute_handler_depth_defaults_to_1(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Missing config (or missing key) defaults to depth 1 → refused."""
    plan = _plan_path(tmp_path)
    monkeypatch.setattr(
        tools, "_config_path", lambda: tmp_path / "does-not-exist" / "config.yaml"
    )
    result = json.loads(tools.execute_handler({"plan": str(plan)}))
    assert result["status"] == "error"
    assert "max_spawn_depth" in result["message"]
    assert fake_ctx.subagent_lifecycle.launches == []

    # Unset key inside an existing delegation block also defaults to 1.
    cfg = tmp_path / "config.yaml"
    cfg.write_text("delegation:\n  max_iterations: 50\n", encoding="utf-8")
    monkeypatch.setattr(tools, "_config_path", lambda: cfg)
    result = json.loads(tools.execute_handler({"plan": str(plan)}))
    assert result["status"] == "error"
    assert fake_ctx.subagent_lifecycle.launches == []


# ── simplify / review handlers ----------------------------------------------


@pytest.mark.parametrize(
    ("tool", "marker"),
    [
        ("simplify", "[jovaltus-pipeline:simplify:simplify]"),
        ("review", "[jovaltus-pipeline:review:review]"),
    ],
)
def test_plan_path_handlers_dispatch(
    tool: str,
    marker: str,
    fake_ctx: FakeCtx,
    fake_home: Path,
    tmp_path: Path,
) -> None:
    """simplify/review dispatch their first phase with role leaf."""
    plan = _plan_path(tmp_path)
    handler = tools.simplify_handler if tool == "simplify" else tools.review_handler
    result = json.loads(handler({"plan": str(plan)}))
    assert result["status"] == "started"
    assert result["tool"] == tool
    assert result["phase"] == tool
    assert result["run_dir"] == str(tmp_path)

    args = _last_launch(fake_ctx)
    assert marker in args.goal
    assert args.role == "leaf"
    assert "[[plan_path]]" not in args.goal


@pytest.mark.parametrize(
    ("tool", "handler"),
    [
        ("simplify", tools.simplify_handler),
        ("review", tools.review_handler),
    ],
)
def test_plan_path_handlers_missing_plan(
    tool: str, handler: Any, fake_ctx: FakeCtx, fake_home: Path
) -> None:
    result = json.loads(handler({}))
    assert result == {"status": "error", "message": f"{tool} requires a plan path"}
    assert fake_ctx.subagent_lifecycle.launches == []


@pytest.mark.parametrize(
    ("tool", "handler"),
    [
        ("simplify", tools.simplify_handler),
        ("review", tools.review_handler),
    ],
)
def test_plan_path_handlers_nonexistent_plan(
    tool: str, handler: Any, fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path
) -> None:
    missing = tmp_path / "nope" / "tasks.md"
    result = json.loads(handler({"plan": str(missing)}))
    assert result == {
        "status": "error",
        "message": f"plan path does not exist: {missing}",
    }
    assert fake_ctx.subagent_lifecycle.launches == []


# ── registration sanity (details covered by test_register.py) ----------------


def test_register_registers_four_tools(fake_ctx: FakeCtx) -> None:
    names = [t["name"] for t in fake_ctx.tools]
    assert names == ["plan", "execute", "simplify", "review"]
    assert all(t["toolset"] == "jovaltus" for t in fake_ctx.tools)
    assert all(t["is_async"] is False for t in fake_ctx.tools)


def test_handler_signatures_accept_args_only() -> None:
    """Handlers are callable as handler(args) — **kwargs is optional."""
    for handler in (
        tools.plan_handler,
        tools.execute_handler,
        tools.simplify_handler,
        tools.review_handler,
    ):
        assert callable(handler)
