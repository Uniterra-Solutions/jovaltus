"""Git subprocess wrappers for Jovaltus plugin.

All functions accept an optional repo_path parameter so they work from
any project directory. Defaults to the current working directory.
"""

import subprocess
from pathlib import Path
from typing import Optional


def _resolve_path(repo_path: Optional[str] = None) -> str:
    """Resolve the repo path, defaulting to cwd."""
    return str(Path(repo_path or ".").resolve())


def _git_cmd(repo_path: Optional[str]) -> list[str]:
    """Build git -C <path> prefix when repo_path is given."""
    return ["git", "-C", _resolve_path(repo_path)]


def is_git_repo(repo_path: Optional[str] = None) -> bool:
    """Check if the given path is inside a git repository."""
    try:
        cmd = _git_cmd(repo_path) + ["rev-parse", "--git-dir"]
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def get_head_hash(repo_path: Optional[str] = None) -> str:
    """Return the full SHA of HEAD."""
    cmd = _git_cmd(repo_path) + ["rev-parse", "HEAD"]
    return subprocess.check_output(cmd, text=True).strip()


def get_diff(start_hash: str,
             end: str = "HEAD",
             repo_path: Optional[str] = None) -> str:
    """Return the git diff between two refs as a string."""
    cmd = _git_cmd(repo_path) + ["diff", start_hash, end]
    try:
        return subprocess.check_output(cmd, text=True).strip()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"git diff failed: {e.stderr.strip()}") from e


def get_diff_stat(start_hash: str,
                  end: str = "HEAD",
                  repo_path: Optional[str] = None) -> list[dict]:
    """Return a list of changed files with stats.

    Each entry: {"path": str, "additions": int, "deletions": int}
    """
    cmd = _git_cmd(repo_path) + ["diff", "--numstat", start_hash, end]
    try:
        out = subprocess.check_output(cmd, text=True).strip()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"git diff --numstat failed: {e.stderr.strip()}") from e

    if not out:
        return []
    files = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) == 3:
            files.append({
                "additions": int(parts[0]) if parts[0] != "-" else 0,
                "deletions": int(parts[1]) if parts[1] != "-" else 0,
                "path": parts[2],
            })
    return files


def stage_all(repo_path: Optional[str] = None) -> None:
    """Stage all changes (git add -A)."""
    cmd = _git_cmd(repo_path) + ["add", "-A"]
    subprocess.run(cmd, check=True, capture_output=True)


def commit(message: str,
           repo_path: Optional[str] = None) -> dict:
    """Commit staged changes. Returns {"success": bool, "message": str}."""
    cmd = _git_cmd(repo_path) + ["commit", "-m", message]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        return {"success": True, "message": result.stdout.strip()}
    else:
        return {"success": False, "message": (result.stderr or result.stdout).strip()}
