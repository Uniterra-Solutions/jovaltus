"""Tests for Jovaltus plugin — git utilities.

Uses temporary git repositories to test git operations.
"""

import subprocess
from pathlib import Path

import pytest

from jovaltus import git_utils


@pytest.fixture
def git_repo(tmp_path: Path) -> Path:
    """Create a temporary git repo with an initial commit."""
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@test.com"],
        cwd=repo, check=True, capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Test"],
        cwd=repo, check=True, capture_output=True,
    )
    # Create an initial commit so HEAD is valid
    (repo / "README.md").write_text("# Test")
    subprocess.run(["git", "add", "-A"], cwd=repo, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "initial"],
        cwd=repo, check=True, capture_output=True,
    )
    return repo


def test_is_git_repo_true(git_repo: Path):
    assert git_utils.is_git_repo(str(git_repo)) is True


def test_is_git_repo_false(tmp_path: Path):
    assert git_utils.is_git_repo(str(tmp_path / "nonexistent")) is False


def test_get_head_hash(git_repo: Path):
    h = git_utils.get_head_hash(str(git_repo))
    assert len(h) == 40  # full SHA
    assert all(c in "0123456789abcdef" for c in h)


def test_get_diff_no_changes(git_repo: Path):
    h = git_utils.get_head_hash(str(git_repo))
    diff = git_utils.get_diff(h, "HEAD", str(git_repo))
    assert diff == ""


def test_get_diff_with_changes(git_repo: Path):
    h = git_utils.get_head_hash(str(git_repo))
    (git_repo / "file.txt").write_text("hello")
    subprocess.run(["git", "add", "file.txt"], cwd=git_repo, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "add file"],
        cwd=git_repo, check=True, capture_output=True,
    )
    diff = git_utils.get_diff(h, "HEAD", str(git_repo))
    assert "hello" in diff
    assert "file.txt" in diff


def test_get_diff_stat(git_repo: Path):
    h = git_utils.get_head_hash(str(git_repo))
    (git_repo / "app.py").write_text("print('hi')\n")
    subprocess.run(["git", "add", "app.py"], cwd=git_repo, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "add app"],
        cwd=git_repo, check=True, capture_output=True,
    )
    stats = git_utils.get_diff_stat(h, "HEAD", str(git_repo))
    assert len(stats) == 1
    assert stats[0]["path"] == "app.py"


def test_stage_and_commit(git_repo: Path):
    (git_repo / "new.txt").write_text("new content")
    subprocess.run(["git", "add", "new.txt"], cwd=git_repo, check=True, capture_output=True)
    cr = git_utils.commit("test commit", str(git_repo))
    assert cr["success"] is True


def test_commit_nothing(git_repo: Path):
    """Committing with no staged changes should not raise."""
    cr = git_utils.commit("nothing", str(git_repo))
    assert cr["success"] is False  # nothing to commit
