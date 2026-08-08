"""Tests for the Jovaltus pipeline state machine and prompt library.

Mirrors the monkeypatch pattern from tests/test_sync.py: patch
``fabricium.state._get_global_hermes_home`` so all persistence lands in a
tmp dir instead of the real ~/.hermes.
"""

import json
from pathlib import Path

import pytest

import fabricium.state as fstate
from jovaltus import state as jstate
from jovaltus.prompts import PROMPT_NAMES, load_prompt

_PLUGIN_NAME = "jovaltus"

# [[token]] placeholders per Contract §4.
PROMPT_TOKENS: dict[str, list[str]] = {
    "prd": ["[[run_dir]]", "[[user_requirements]]"],
    "research": ["[[run_dir]]"],
    "acceptance": ["[[run_dir]]"],
    "tasks": ["[[run_dir]]"],
    "execute": ["[[run_dir]]", "[[plan_path]]"],
    "simplify-review": ["[[run_dir]]", "[[plan_path]]"],
    "review": ["[[run_dir]]", "[[plan_path]]"],
}


@pytest.fixture
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect fabricium state persistence into a temp dir."""
    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: tmp_path)
    return tmp_path


def _state_file(home: Path) -> Path:
    return home / f"{_PLUGIN_NAME}_state.json"


def test_get_pipeline_idle(fake_home: Path) -> None:
    """No pipeline started -> get_pipeline() returns None."""
    assert jstate.get_pipeline() is None


@pytest.mark.parametrize(
    ("legacy_phase", "migrated_phase"),
    [
        ("simplify_fix", "simplify_waiting"),
        ("review_fix", "review_waiting"),
    ],
)
def test_get_pipeline_migrates_legacy_fixer_phase(
    fake_home: Path, legacy_phase: str, migrated_phase: str
) -> None:
    """v1.1.2 fixer phases migrate to the v1.1.3+ waiting phases.

    A pipeline started on an older plugin keeps its phase on disk. After an
    upgrade, get_pipeline() must map simplify_fix/review_fix to the waiting
    phases — otherwise the new CHAIN KeyErrors on the stale key and the
    pipeline strands mid-loop.
    """
    raw = _state_file(fake_home)
    raw.write_text(
        json.dumps(
            {
                "profiles": {},
                "pipeline": {
                    "run_dir": "/tmp/run",
                    "tool": "simplify"
                    if legacy_phase.startswith("simplify")
                    else "review",
                    "phase": legacy_phase,
                    "status": "running",
                    "user_requirements": "",
                    "plan_path": "/tmp/run/tasks.md",
                    "active_child_session_id": None,
                    "loop_iteration": 3,
                    "verdict": "fix",
                    "updated_at": "2026-08-08T00:00:00+00:00",
                    "error": None,
                },
            }
        ),
        encoding="utf-8",
    )

    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == migrated_phase
    assert p.loop_iteration == 3
    assert p.verdict == "fix"
    # The migration is persisted, not just returned in memory.
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.phase == migrated_phase


def test_get_pipeline_clears_unknown_phase(fake_home: Path) -> None:
    """A corrupt/unknown phase is auto-cleared so it cannot deadlock the chain.

    If a stale or foreign state carries a phase the CHAIN does not know, the
    hooks would KeyError on CHAIN[tool][phase] and strand the pipeline in
    status=running forever. get_pipeline() clears it back to idle.
    """
    raw = _state_file(fake_home)
    raw.write_text(
        json.dumps(
            {
                "profiles": {},
                "pipeline": {
                    "run_dir": "/tmp/run",
                    "tool": "plan",
                    "phase": "totally_bogus_phase",
                    "status": "running",
                    "user_requirements": "",
                    "plan_path": None,
                    "active_child_session_id": None,
                    "loop_iteration": 0,
                    "verdict": None,
                    "updated_at": "2026-08-08T00:00:00+00:00",
                    "error": None,
                },
            }
        ),
        encoding="utf-8",
    )

    assert jstate.get_pipeline() is None
    assert jstate.get_pipeline() is None  # still idle on next read


def test_get_pipeline_keeps_valid_phases(fake_home: Path) -> None:
    """Valid running/done phases pass through untouched."""
    jstate.start_pipeline("plan", run_dir="/tmp/run", user_requirements="req")
    jstate.set_phase(jstate.get_pipeline(), "done")  # type: ignore[arg-type]
    p = jstate.get_pipeline()
    assert p is not None
    assert p.phase == "done"


def test_start_pipeline_plan(fake_home: Path) -> None:
    """plan starts at phase prd with status running and persists."""
    p = jstate.start_pipeline(
        "plan", run_dir="/tmp/run", user_requirements="Build an app"
    )
    assert p.phase == "prd"
    assert p.status == "running"
    assert p.tool == "plan"
    assert p.user_requirements == "Build an app"
    assert p.plan_path is None
    assert p.active_child_session_id is None
    assert p.loop_iteration == 0
    assert p.verdict is None
    assert p.error is None
    assert p.updated_at
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed == p


@pytest.mark.parametrize(
    ("tool", "first_phase"),
    [
        ("plan", "prd"),
        ("execute", "execute"),
        ("simplify", "simplify"),
        ("review", "review"),
    ],
)
def test_start_pipeline_first_phase(
    fake_home: Path, tool: str, first_phase: str
) -> None:
    """Each tool starts in its chain's first phase."""
    p = jstate.start_pipeline(tool, run_dir="/tmp/run", plan_path="/tmp/run/tasks.md")
    assert p.phase == first_phase
    assert p.plan_path == "/tmp/run/tasks.md"


def test_start_pipeline_overwrites(fake_home: Path) -> None:
    """start_pipeline overwrites any existing pipeline."""
    jstate.start_pipeline("plan", run_dir="/tmp/run1", user_requirements="first")
    p = jstate.start_pipeline(
        "review", run_dir="/tmp/run2", plan_path="/tmp/run2/tasks.md"
    )
    assert p.tool == "review"
    assert p.phase == "review"
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.run_dir == "/tmp/run2"
    assert resumed.tool == "review"


def test_start_pipeline_unknown_tool(fake_home: Path) -> None:
    with pytest.raises(ValueError):
        jstate.start_pipeline("bogus", run_dir="/tmp/run")


def test_transition_round_trips(fake_home: Path) -> None:
    """set_phase/register_child/set_verdict/finish/reset all round-trip."""
    p = jstate.start_pipeline("plan", run_dir="/tmp/run")
    assert p.phase == "prd"

    jstate.set_phase(p, "research")
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.phase == "research"

    jstate.register_child(p, "child-1")
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.active_child_session_id == "child-1"

    jstate.set_verdict(p, "fix")
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.verdict == "fix"

    jstate.finish_pipeline(p, True)
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.status == "done"

    jstate.reset_pipeline()
    assert jstate.get_pipeline() is None


def test_complete_child_non_matching_id(fake_home: Path) -> None:
    """A non-matching child id is a no-op (returns False, keeps child)."""
    p = jstate.start_pipeline("plan", run_dir="/tmp/run")
    jstate.register_child(p, "expected-child")
    assert jstate.complete_child(p, "other-child", "success", "done") is False
    assert p.active_child_session_id == "expected-child"
    assert p.status == "running"
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.active_child_session_id == "expected-child"


def test_complete_child_matching_id(fake_home: Path) -> None:
    """A matching child id completes (returns True, clears the child)."""
    p = jstate.start_pipeline("plan", run_dir="/tmp/run")
    jstate.register_child(p, "expected-child")
    assert jstate.complete_child(p, "expected-child", "success", "done") is True
    assert p.active_child_session_id is None
    assert p.status == "running"
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.active_child_session_id is None


def test_complete_child_failure(fake_home: Path) -> None:
    """A non-success child status marks the pipeline failed with the error."""
    p = jstate.start_pipeline("plan", run_dir="/tmp/run")
    jstate.register_child(p, "expected-child")
    assert jstate.complete_child(p, "expected-child", "failed", "boom") is True
    assert p.status == "failed"
    assert p.error == "boom"
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.status == "failed"
    assert resumed.error == "boom"


def test_finish_pipeline_failure(fake_home: Path) -> None:
    """finish_pipeline(ok=False) records the error and fails the pipeline."""
    p = jstate.start_pipeline(
        "execute", run_dir="/tmp/run", plan_path="/tmp/run/tasks.md"
    )
    jstate.finish_pipeline(p, False, error="child blew up")
    assert p.status == "failed"
    assert p.error == "child blew up"
    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.status == "failed"
    assert resumed.error == "child blew up"


def test_cross_session_resume(fake_home: Path) -> None:
    """A running pipeline re-reads identically from JSON (fresh session)."""
    p = jstate.start_pipeline(
        "simplify", run_dir="/tmp/run", plan_path="/tmp/run/tasks.md"
    )
    jstate.register_child(p, "child-xyz")
    p.loop_iteration = 2
    jstate.set_verdict(p, "fix")

    resumed = jstate.get_pipeline()
    assert resumed is not None
    assert resumed.tool == "simplify"
    assert resumed.phase == "simplify"
    assert resumed.status == "running"
    assert resumed.active_child_session_id == "child-xyz"
    assert resumed.loop_iteration == 2
    assert resumed.verdict == "fix"
    assert resumed.run_dir == "/tmp/run"
    assert resumed.plan_path == "/tmp/run/tasks.md"
    assert resumed.user_requirements == ""


def test_profiles_key_preserved(fake_home: Path) -> None:
    """Pipeline writes never clobber the fabricium-owned "profiles" key."""
    profiles = {
        "jovaltus-agent": {"soul_md": True, "updated_at": "2025-01-01T00:00:00"}
    }
    _state_file(fake_home).write_text(json.dumps({"profiles": profiles}))

    p = jstate.start_pipeline("plan", run_dir="/tmp/run")
    jstate.set_phase(p, "tasks")
    jstate.register_child(p, "child-1")
    jstate.set_verdict(p, "pass")
    jstate.finish_pipeline(p, True)

    saved = json.loads(_state_file(fake_home).read_text(encoding="utf-8"))
    assert saved["profiles"] == profiles
    assert saved["pipeline"]["status"] == "done"

    jstate.reset_pipeline()
    saved = json.loads(_state_file(fake_home).read_text(encoding="utf-8"))
    assert saved["profiles"] == profiles
    assert "pipeline" not in saved


def test_to_from_dict_round_trip() -> None:
    """to_dict()/from_dict() round-trip losslessly."""
    p = jstate.PipelineState(
        run_dir="/r",
        tool="plan",
        phase="research",
        status="running",
        user_requirements="u",
        plan_path="/r/tasks.md",
        active_child_session_id="c1",
        loop_iteration=2,
        verdict="fix",
        updated_at="2026-08-07T00:00:00+00:00",
        error=None,
    )
    assert jstate.PipelineState.from_dict(p.to_dict()) == p


def test_status_text_running(fake_home: Path) -> None:
    p = jstate.start_pipeline("plan", run_dir="/abs/run")
    assert (
        jstate.status_text(p)
        == "[Jovaltus pipeline] tool=plan phase=prd status=running run_dir=/abs/run"
    )


def test_status_text_plan_complete(fake_home: Path) -> None:
    p = jstate.start_pipeline("plan", run_dir="/abs/run")
    jstate.set_phase(p, "done")
    jstate.finish_pipeline(p, True)
    assert jstate.status_text(p) == (
        "[Jovaltus pipeline] tool=plan phase=done status=done run_dir=/abs/run"
        " — plan complete: /abs/run/tasks.md"
    )


def test_prompt_names() -> None:
    assert PROMPT_NAMES == (
        "prd",
        "research",
        "acceptance",
        "tasks",
        "execute",
        "simplify-review",
        "review",
    )


def test_load_prompt_all_names() -> None:
    """All 7 prompts load as non-empty Markdown."""
    for name in PROMPT_NAMES:
        text = load_prompt(name)
        assert text.strip(), f"prompt {name!r} is empty"
        assert text.lstrip().startswith("#"), f"prompt {name!r} is not Markdown"


def test_load_prompt_unknown_name() -> None:
    with pytest.raises(FileNotFoundError):
        load_prompt("does-not-exist")


def test_prompt_tokens_present() -> None:
    """Every prompt contains its Contract §4 [[token]] placeholders."""
    for name, tokens in PROMPT_TOKENS.items():
        text = load_prompt(name)
        for token in tokens:
            assert token in text, f"{name}.md missing token {token}"


def test_every_prompt_has_marker_placeholder() -> None:
    """Every prompt carries the literal pipeline marker placeholder."""
    for name in PROMPT_NAMES:
        assert "[jovaltus-pipeline:TOOL:PHASE]" in load_prompt(name), name


def test_execute_prompt_forbids_commits() -> None:
    """execute.md must forbid git commits and drive level-by-level DAGs."""
    text = load_prompt("execute")
    lowered = text.lower()
    assert "do not commit" in lowered
    assert "agents.md" in lowered
    assert "parallel" in lowered


def test_tasks_prompt_requires_one_execution_form() -> None:
    """tasks.md must pick ONE execution form, not write all three.

    Regression (2026-08-07): the tasks subagent emitted serial + batch +
    fully-parallel sections in tasks.md. The execute orchestrator drives the
    DAG level-by-level, so the manifest should choose the single matching
    form (batch by default) and document only that one.
    """
    text = load_prompt("tasks")
    lowered = text.lower()
    assert "three forms" not in lowered
    assert "choose exactly one" in lowered
    assert "do not list multiple forms" in lowered
    assert "batch" in lowered
    assert "serial" in lowered
    assert "mermaid" in lowered
