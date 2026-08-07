"""Unit tests for the Jovaltus hook callbacks (Contract §2, §5).

The hooks are driven with a fake ctx (so ``dispatch_pipeline_step`` records
its ``subagent_lifecycle.launch`` call) and fabricium state persistence is
monkeypatched into a tmp dir. ``on_subagent_start``/``on_subagent_stop`` are
exercised exactly as the agent loop invokes them: kwargs only.
"""

import json
from pathlib import Path
from typing import Any

import pytest

import fabricium.skills as fskills
import fabricium.state as fstate
from jovaltus import hooks, state as jstate, tools


class FakeHandle:
    """Stub of SubagentHandle: the fields tools.py reads after launch."""

    def __init__(self, subagent_id: str = "sa-1") -> None:
        self.subagent_id = subagent_id
        self.parent_session_id: str | None = None
        self.depth = 1


class FakeLifecycle:
    """Stub of PluginContext.subagent_lifecycle: records launch requests."""

    def __init__(self) -> None:
        self.launches: list[Any] = []

    def launch(self, request: Any) -> FakeHandle:
        self.launches.append(request)
        return FakeHandle()


class FakeCtx:
    """Minimal ctx stub: records subagent_lifecycle.launch for the pipeline."""

    def __init__(self) -> None:
        self.subagent_lifecycle = FakeLifecycle()

    def register_tool(
        self,
        name: str,
        toolset: str,
        schema: dict[str, Any],
        handler: Any,
        **kwargs: Any,
    ) -> None:
        pass


@pytest.fixture
def fake_ctx(fake_home: Path, monkeypatch: pytest.MonkeyPatch) -> FakeCtx:
    ctx = FakeCtx()
    # tools.py dispatches via _get_lifecycle() (module-level) — wire the fake.
    monkeypatch.setattr(tools, "_get_lifecycle", lambda: ctx.subagent_lifecycle)
    tools.register(ctx)
    hooks.init(ctx)
    return ctx


@pytest.fixture
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect fabricium state persistence into a temp dir."""
    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: tmp_path)
    monkeypatch.setattr(fskills, "_get_global_hermes_home", lambda: tmp_path)
    return tmp_path


def _marker_goal(tool: str, phase: str) -> str:
    return f"goal text [jovaltus-pipeline:{tool}:{phase}] tail"


def _run_child(
    child_session_id: str = "child-1",
    status: str = "success",
    summary: str = "ok",
) -> None:
    """Simulate one full child lifecycle against the current pipeline."""
    p = jstate.get_pipeline()
    assert p is not None, "no pipeline started"
    hooks.on_subagent_start(
        parent_session_id="sess",
        child_session_id=child_session_id,
        child_role="leaf",
        child_goal=_marker_goal(p.tool, p.phase),
    )
    hooks.on_subagent_stop(
        parent_session_id="sess",
        child_session_id=child_session_id,
        child_role="leaf",
        child_summary=summary,
        child_status=status,
    )


def _last_goal(fake_ctx: FakeCtx) -> str:
    assert fake_ctx.subagent_lifecycle.launches, "no launch recorded"
    return str(fake_ctx.subagent_lifecycle.launches[-1].goal)


def _verdict(run_dir: Path, verdict: str) -> None:
    (run_dir / "verdict.json").write_text(
        json.dumps({"verdict": verdict, "findings": "x"}), encoding="utf-8"
    )


# ── subagent_start ----------------------------------------------------------


def test_on_subagent_start_records_active_child(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    jstate.start_pipeline("plan", "/tmp/run", user_requirements="req")
    hooks.on_subagent_start(
        child_session_id="child-9", child_goal=_marker_goal("plan", "prd")
    )
    p = jstate.get_pipeline()
    assert p is not None
    assert p.active_child_session_id == "child-9"
    assert fake_ctx.subagent_lifecycle.launches == []


def test_on_subagent_start_no_pipeline_is_noop(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    hooks.on_subagent_start(
        child_session_id="child-9", child_goal=_marker_goal("plan", "prd")
    )
    assert jstate.get_pipeline() is None


def test_on_subagent_start_non_matching_goal_is_noop(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    jstate.start_pipeline("plan", "/tmp/run", user_requirements="req")
    # No marker at all (user-initiated subagent).
    hooks.on_subagent_start(child_session_id="c1", child_goal="just a goal")
    # Marker for a different tool.
    hooks.on_subagent_start(
        child_session_id="c2", child_goal=_marker_goal("review", "review")
    )
    # Marker for a different phase of the same tool.
    hooks.on_subagent_start(
        child_session_id="c3", child_goal=_marker_goal("plan", "tasks")
    )
    # Malformed marker.
    hooks.on_subagent_start(
        child_session_id="c4", child_goal="[jovaltus-pipeline:plan]"
    )
    p = jstate.get_pipeline()
    assert p is not None
    assert p.active_child_session_id is None


# ── subagent_stop: plan chain ----------------------------------------------


def test_on_subagent_stop_advances_plan_chain(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    """prd → research → acceptance → tasks → done, one dispatch per step."""
    jstate.start_pipeline("plan", "/tmp/run", user_requirements="req")

    _run_child()  # prd completes
    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == "research"
    assert p.active_child_session_id is None
    assert "[jovaltus-pipeline:plan:research]" in _last_goal(fake_ctx)
    assert "design.md" in _last_goal(fake_ctx)  # research prompt

    _run_child()  # research completes
    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == "acceptance"
    assert "[jovaltus-pipeline:plan:acceptance]" in _last_goal(fake_ctx)

    _run_child()  # acceptance completes
    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == "tasks"
    assert "[jovaltus-pipeline:plan:tasks]" in _last_goal(fake_ctx)

    _run_child()  # tasks completes → done, no further dispatch
    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == "done"
    assert p.status == "done"
    assert p.error is None
    dispatches = [r.goal for r in fake_ctx.subagent_lifecycle.launches]
    assert len(dispatches) == 3  # research, acceptance, tasks only


def test_on_subagent_stop_execute_chain(fake_ctx: FakeCtx, fake_home: Path) -> None:
    """execute → done with exactly one dispatch (the orchestrator)."""
    jstate.start_pipeline("execute", "/tmp/run", plan_path="/tmp/run/tasks.md")
    _run_child()
    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == "done"
    assert p.status == "done"
    assert (
        fake_ctx.subagent_lifecycle.launches == []
    )  # first phase was launched by the handler


def test_on_subagent_stop_non_matching_id_is_noop(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    """A completing child that is not the active one never touches the pipeline."""
    jstate.start_pipeline("plan", "/tmp/run", user_requirements="req")
    hooks.on_subagent_start(
        child_session_id="active-1", child_goal=_marker_goal("plan", "prd")
    )

    hooks.on_subagent_stop(
        child_session_id="other-9", child_status="success", child_summary="ok"
    )
    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == "prd"
    assert p.active_child_session_id == "active-1"
    assert fake_ctx.subagent_lifecycle.launches == []


def test_on_subagent_stop_failure_finishes_failed(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    jstate.start_pipeline("plan", "/tmp/run", user_requirements="req")
    _run_child(status="failed", summary="child blew up")
    p = jstate.get_pipeline()
    assert p is not None
    assert p.status == "failed"
    assert p.error == "child blew up"
    assert fake_ctx.subagent_lifecycle.launches == []  # no advance on failure


def test_on_subagent_stop_completed_status_is_success(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    """Hermes v0.20.0 emits child_status='completed' — must count as success.

    Regression: the first Docker E2E run failed the pipeline because
    complete_child only accepted 'success' while _run_single_child emits
    'completed' (delegate_tool.py:2329).
    """
    jstate.start_pipeline("plan", "/tmp/run", user_requirements="req")
    _run_child(status="completed", summary="PRD written")
    p = jstate.get_pipeline()
    assert p is not None
    assert p.status == "running"  # not failed
    assert p.phase == "research"  # chain advanced
    assert p.error is None


# ── subagent_stop: simplify / review verdict loops --------------------------


@pytest.mark.parametrize(
    ("tool", "fix_phase", "reviewer_marker", "fixer_marker"),
    [
        (
            "simplify",
            "simplify_fix",
            "[jovaltus-pipeline:simplify:simplify]",
            "[jovaltus-pipeline:simplify:simplify_fix]",
        ),
        (
            "review",
            "review_fix",
            "[jovaltus-pipeline:review:review]",
            "[jovaltus-pipeline:review:review_fix]",
        ),
    ],
)
def test_verdict_pass_finishes_done(
    tool: str,
    fix_phase: str,
    reviewer_marker: str,
    fixer_marker: str,
    fake_ctx: FakeCtx,
    fake_home: Path,
    tmp_path: Path,
) -> None:
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    _verdict(run_dir, "pass")
    jstate.start_pipeline(tool, str(run_dir), plan_path=str(run_dir / "tasks.md"))

    _run_child()  # reviewer passes
    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == "done"
    assert p.status == "done"
    assert p.verdict == "pass"
    assert fake_ctx.subagent_lifecycle.launches == []  # no fixer dispatched


@pytest.mark.parametrize(
    ("tool", "fix_phase", "reviewer_marker", "fixer_marker"),
    [
        (
            "simplify",
            "simplify_fix",
            "[jovaltus-pipeline:simplify:simplify]",
            "[jovaltus-pipeline:simplify:simplify_fix]",
        ),
        (
            "review",
            "review_fix",
            "[jovaltus-pipeline:review:review]",
            "[jovaltus-pipeline:review:review_fix]",
        ),
    ],
)
def test_verdict_fix_loop_no_cap(
    tool: str,
    fix_phase: str,
    reviewer_marker: str,
    fixer_marker: str,
    fake_ctx: FakeCtx,
    fake_home: Path,
    tmp_path: Path,
) -> None:
    """fix → fixer → reviewer → fix → fixer → reviewer (no iteration cap)."""
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    _verdict(run_dir, "fix")
    jstate.start_pipeline(tool, str(run_dir), plan_path=str(run_dir / "tasks.md"))

    for iteration in (1, 2):
        _run_child()  # reviewer -> fix
        p = jstate.get_pipeline()
        assert p is not None
        assert p.phase == fix_phase
        assert p.loop_iteration == iteration
        assert p.verdict == "fix"
        assert fixer_marker in _last_goal(fake_ctx)

        _run_child()  # fixer -> back to reviewer
        p = jstate.get_pipeline()
        assert p is not None
        assert p.phase == tool
        assert p.loop_iteration == iteration
        assert reviewer_marker in _last_goal(fake_ctx)


def test_verdict_fix_then_pass(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path
) -> None:
    """A fix round followed by a passing review completes the pipeline."""
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    _verdict(run_dir, "fix")
    jstate.start_pipeline("simplify", str(run_dir), plan_path=str(run_dir / "tasks.md"))

    _run_child()  # reviewer -> fix
    _run_child()  # fixer -> reviewer
    _verdict(run_dir, "pass")
    _run_child()  # reviewer passes

    p = jstate.get_pipeline()
    assert p is not None
    assert p.status == "done"
    assert p.phase == "done"
    assert p.loop_iteration == 1


def test_missing_verdict_file_fails_pipeline(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path
) -> None:
    """A successful reviewer that wrote no verdict.json fails the pipeline."""
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    jstate.start_pipeline("review", str(run_dir), plan_path=str(run_dir / "tasks.md"))

    _run_child()
    p = jstate.get_pipeline()
    assert p is not None
    assert p.status == "failed"
    assert p.error is not None and "verdict.json" in p.error
    assert fake_ctx.subagent_lifecycle.launches == []


def test_invalid_verdict_file_fails_pipeline(
    fake_ctx: FakeCtx, fake_home: Path, tmp_path: Path
) -> None:
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    (run_dir / "verdict.json").write_text("not json", encoding="utf-8")
    jstate.start_pipeline("simplify", str(run_dir), plan_path=str(run_dir / "tasks.md"))

    _run_child()
    p = jstate.get_pipeline()
    assert p is not None
    assert p.status == "failed"


# ── pre_llm_call ------------------------------------------------------------


def test_on_pre_llm_call_returns_context_when_pipeline(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    jstate.start_pipeline("plan", "/abs/run", user_requirements="req")
    assert hooks.on_pre_llm_call() == {
        "context": "[Jovaltus pipeline] tool=plan phase=prd status=running run_dir=/abs/run"
    }


def test_on_pre_llm_call_returns_none_when_idle(
    fake_ctx: FakeCtx, fake_home: Path
) -> None:
    assert hooks.on_pre_llm_call() is None


def test_hooks_are_resilient_to_state_errors(
    fake_ctx: FakeCtx, fake_home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A state-layer exception never propagates out of a hook callback."""
    monkeypatch.setattr(
        jstate, "get_pipeline", lambda: (_ for _ in ()).throw(RuntimeError("boom"))
    )
    assert hooks.on_pre_llm_call() is None
    hooks.on_subagent_start(child_session_id="c1", child_goal="whatever")
    hooks.on_subagent_stop(child_session_id="c1", child_status="success")
