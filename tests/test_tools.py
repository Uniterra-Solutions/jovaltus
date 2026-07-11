"""Tests for Jovaltus plugin — tool handlers.

Uses mocked ctx to verify handler behaviour
without a live Hermes runtime.
"""

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from jovaltus.tools import (
    make_implement_handler,
    make_verify_handler,
    make_simplify_handler,
)


def _make_commit(repo: Path, filename: str, content: str = "x = 1") -> None:
    """Create a file and commit it to the repo."""
    (repo / filename).write_text(content)
    subprocess.run(["git", "add", filename], cwd=repo, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", f"add {filename}"],
        cwd=repo,
        check=True,
        capture_output=True,
    )


def _get_hash(repo: Path, ref: str = "HEAD") -> str:
    """Get commit hash for a git ref."""
    return subprocess.check_output(
        ["git", "rev-parse", ref], cwd=repo, text=True
    ).strip()


@pytest.fixture
def ctx() -> MagicMock:
    return MagicMock()


# ── jovaltus_implement ────────────────────────────────────────────


def test_implement_not_git_dir(ctx: MagicMock):
    """Non-git directory should return an error."""
    handler = make_implement_handler(ctx)
    result = json.loads(handler({"project_dir": "/tmp/nonexistent-12345"}))
    assert "error" in result
    assert "git" in result["error"].lower()


def test_implement_rejects_when_active_task(ctx: MagicMock, git_repo: Path):
    """Implement should fail if another task is already active."""
    from jovaltus import state

    tid = state.create_task(str(git_repo), "abc")
    state.set_active_task(tid)
    state.set_stage(tid, "implement")

    handler = make_implement_handler(ctx)
    result = json.loads(handler({"project_dir": str(git_repo)}))
    assert "error" in result
    assert "implement" in result["error"].lower()
    assert "active_task" in result


def test_implement_success(ctx: MagicMock, git_repo: Path):
    """Happy path: creates task and dispatches subagent."""
    handler = make_implement_handler(ctx)
    result = json.loads(handler({"project_dir": str(git_repo)}))

    assert "task_id" in result
    assert "start_hash" in result
    assert len(result["start_hash"]) == 40
    assert result["subagent"] == "spawned"
    assert result["phase"] == "implement"

    # Should have called dispatch_tool once
    assert ctx.dispatch_tool.call_count == 1
    call_args = ctx.dispatch_tool.call_args[0]
    assert call_args[0] == "delegate_task"
    assert "goal" in call_args[1]
    assert "implement" in call_args[1]["goal"].lower()


def test_implement_with_plan(ctx: MagicMock, git_repo: Path):
    """Implement with plan should pass plan to subagent context."""
    handler = make_implement_handler(ctx)
    plan_text = (
        "## Requirements Checklist\n\n"
        '- Add /api/health endpoint that returns {"status": "ok"}\n'
        "- Add input validation to POST /api/users\n"
        "- Write tests for both endpoints\n"
    )
    result = json.loads(handler({"project_dir": str(git_repo), "plan": plan_text}))

    assert "task_id" in result
    assert result["plan"] == plan_text

    # Verify plan appears in dispatched context
    call_args = ctx.dispatch_tool.call_args[0]
    context = call_args[1]["context"]
    assert "## Plan" in context
    assert "/api/health" in context
    assert "input validation" in context


def test_implement_without_plan_omits_plan_section(ctx: MagicMock, git_repo: Path):
    """Implement without plan should not include ## Plan in context."""
    handler = make_implement_handler(ctx)
    result = json.loads(handler({"project_dir": str(git_repo)}))

    assert "task_id" in result

    call_args = ctx.dispatch_tool.call_args[0]
    context = call_args[1]["context"]
    assert "## Plan" not in context
    assert result["plan"] == ""


# ── jovaltus_verify ───────────────────────────────────────────────


def test_verify_no_task_id(ctx: MagicMock):
    handler = make_verify_handler(ctx)
    result = json.loads(handler({"task_id": "nonexistent"}))
    assert "error" in result
    # Stage validation should report task not found
    assert "not found" in result["error"].lower()


def test_verify_rejects_wrong_stage(ctx: MagicMock, git_repo: Path):
    """Verify should fail if the task is not in 'implement' stage."""
    # Create a task but don't set stage to implement
    from jovaltus import state

    tid = state.create_task(str(git_repo), "abc")
    state.set_active_task(tid)
    # Stage is still "idle"

    handler = make_verify_handler(ctx)
    result = json.loads(handler({"task_id": tid, "project_dir": str(git_repo)}))
    assert "error" in result
    assert "verify" in result["error"].lower()
    assert "idle" in result.get("current_stage", "")


def test_verify_success(ctx: MagicMock, git_repo: Path):
    """Verify handler should compute diff and dispatch."""
    # Create a task first via implement handler
    impl_handler = make_implement_handler(ctx)
    ctx.reset_mock()
    impl_result = json.loads(impl_handler({"project_dir": str(git_repo)}))
    task_id = impl_result["task_id"]
    # Stage is now "implement" (set by implement handler)

    # Make a change so there's something to diff
    _make_commit(git_repo, "file.py")

    ctx.reset_mock()
    verify_handler = make_verify_handler(ctx)
    result = json.loads(
        verify_handler({"task_id": task_id, "project_dir": str(git_repo)})
    )

    assert result["subagent"] == "spawned"
    assert result["phase"] == "verify"
    assert "diff" in result
    assert "file.py" in result["diff"] or result["files_changed"]
    assert ctx.dispatch_tool.called


# ── jovaltus_verify (commit-based mode) ───────────────────────────


def test_verify_commit_mode_no_params(ctx: MagicMock, git_repo: Path):
    """Verify should error if neither task_id nor before is given."""
    handler = make_verify_handler(ctx)
    result = json.loads(handler({"project_dir": str(git_repo)}))
    assert "error" in result
    assert "task_id" in result["error"].lower() or "before" in result["error"].lower()


def test_verify_commit_mode_both_task_id_and_before(ctx: MagicMock, git_repo: Path):
    """Verify should error if both task_id and before are provided."""
    handler = make_verify_handler(ctx)
    result = json.loads(
        handler(
            {
                "task_id": "jt-123",
                "before": "abc123",
                "project_dir": str(git_repo),
            }
        )
    )
    assert "error" in result
    assert "not both" in result["error"].lower()


def test_verify_commit_mode_before_only(ctx: MagicMock, git_repo: Path):
    """Verify with only 'before' should diff before..HEAD and dispatch."""
    # Make a commit so we have a reference point
    _make_commit(git_repo, "file.py")
    before = _get_hash(git_repo, "HEAD~1")

    ctx.reset_mock()
    handler = make_verify_handler(ctx)
    result = json.loads(handler({"before": before, "project_dir": str(git_repo)}))

    assert result["subagent"] == "spawned"
    assert result["phase"] == "verify"
    assert "before" in result
    assert "after" in result
    assert result["pipeline_mode"] is False
    assert ctx.dispatch_tool.called

    # Verify the diff is against HEAD (not HEAD~1 alone)
    call_args = ctx.dispatch_tool.call_args[0]
    context = call_args[1]["context"]
    assert before in context
    assert "file.py" in context


def test_verify_commit_mode_before_after(ctx: MagicMock, git_repo: Path):
    """Verify with before+after should diff the exact range."""
    _make_commit(git_repo, "a.py", "a = 1")
    after = _get_hash(git_repo)
    _make_commit(git_repo, "b.py", "b = 2")
    before = _get_hash(git_repo, "HEAD~1")

    ctx.reset_mock()
    handler = make_verify_handler(ctx)
    result = json.loads(
        handler(
            {
                "before": before,
                "after": after,
                "project_dir": str(git_repo),
            }
        )
    )

    assert result["subagent"] == "spawned"
    assert result["after"] == after
    assert result["before"] == before

    # Context should reference the exact range
    call_args = ctx.dispatch_tool.call_args[0]
    context = call_args[1]["context"]
    assert before in context
    assert after in context


# ── jovaltus_simplify (commit-based mode) ─────────────────────────


def test_simplify_commit_mode_no_params(ctx: MagicMock, git_repo: Path):
    """Simplify should error if neither task_id nor before is given."""
    handler = make_simplify_handler(ctx)
    result = json.loads(handler({"project_dir": str(git_repo)}))
    assert "error" in result


def test_simplify_commit_mode_both_task_id_and_before(ctx: MagicMock, git_repo: Path):
    """Simplify should error if both task_id and before are provided."""
    handler = make_simplify_handler(ctx)
    result = json.loads(
        handler(
            {
                "task_id": "jt-123",
                "before": "abc123",
                "project_dir": str(git_repo),
            }
        )
    )
    assert "error" in result
    assert "not both" in result["error"].lower()


def test_simplify_commit_mode_before_only(ctx: MagicMock, git_repo: Path):
    """Simplify with only 'before' should diff before..HEAD and dispatch."""
    _make_commit(git_repo, "app.py", "print(1)\n")
    before = _get_hash(git_repo, "HEAD~1")

    ctx.reset_mock()
    handler = make_simplify_handler(ctx)
    result = json.loads(handler({"before": before, "project_dir": str(git_repo)}))

    assert result["subagent"] == "spawned"
    assert result["phase"] == "simplify"
    assert "before" in result
    assert "after" in result
    assert result["pipeline_mode"] is False
    assert ctx.dispatch_tool.called


def test_simplify_commit_mode_before_after(ctx: MagicMock, git_repo: Path):
    """Simplify with before+after should diff the exact range."""
    _make_commit(git_repo, "x.py", "x = 1")
    after = _get_hash(git_repo)
    _make_commit(git_repo, "y.py", "y = 2")
    before = _get_hash(git_repo, "HEAD~1")

    ctx.reset_mock()
    handler = make_simplify_handler(ctx)
    result = json.loads(
        handler(
            {
                "before": before,
                "after": after,
                "project_dir": str(git_repo),
            }
        )
    )

    assert result["subagent"] == "spawned"
    assert result["after"] == after
    assert result["before"] == before


def test_simplify_no_task_id(ctx: MagicMock):
    handler = make_simplify_handler(ctx)
    result = json.loads(handler({"task_id": "nonexistent"}))
    assert "error" in result


def test_simplify_rejects_wrong_stage(ctx: MagicMock, git_repo: Path):
    """Simplify should fail if the task is not in 'verify' stage."""

    # Create task in implement stage (via implement handler)
    impl_handler = make_implement_handler(ctx)
    ctx.reset_mock()
    impl_result = json.loads(impl_handler({"project_dir": str(git_repo)}))
    task_id = impl_result["task_id"]
    # Stage is "implement"

    handler = make_simplify_handler(ctx)
    result = json.loads(handler({"task_id": task_id, "project_dir": str(git_repo)}))
    assert "error" in result
    assert "simplify" in result["error"].lower()
    assert "implement" in result.get("current_stage", "")


def test_simplify_success(ctx: MagicMock, git_repo: Path):
    """Simplify handler should compute clean diff and dispatch."""
    from jovaltus import state

    impl_handler = make_implement_handler(ctx)
    ctx.reset_mock()
    impl_result = json.loads(impl_handler({"project_dir": str(git_repo)}))
    task_id = impl_result["task_id"]
    # Set stage to "verify" so simplify can proceed
    state.set_stage(task_id, "verify")

    _make_commit(git_repo, "app.py", "print(1)\n")

    ctx.reset_mock()
    simplify_handler = make_simplify_handler(ctx)
    result = json.loads(
        simplify_handler({"task_id": task_id, "project_dir": str(git_repo)})
    )

    assert result["subagent"] == "spawned"
    assert result["phase"] == "simplify"
    assert ctx.dispatch_tool.called


# ── Prompt files exist ────────────────────────────────────────────


def test_prompt_files_exist():
    """The three prompt files should be present and non-empty."""
    base = Path(__file__).parent.parent / "prompts"
    for name in ["implement", "verify", "simplify"]:
        path = base / f"{name}.md"
        assert path.exists(), f"Missing prompt: {path}"
        assert path.read_text().strip(), f"Empty prompt: {path}"
