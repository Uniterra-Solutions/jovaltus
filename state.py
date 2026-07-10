"""In-memory task state for Jovaltus plugin.

Each task records:
- task_id: unique string ID
- project_dir: absolute path to the git repo
- start_hash: git commit hash when the task began
- created_at: Unix timestamp

Stage machine tracks pipeline progress:
    idle → implement → verify → simplify → done
"""

import threading
import time
from typing import Any, Optional, cast

_tasks: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()
_counter = 0

# ── Stage machine ──────────────────────────────────────────────────

STAGE_ORDER = ["idle", "implement", "verify", "simplify", "done"]

_VALID_TRANSITIONS: dict[str, set[str]] = {
    "idle": {"implement"},
    "implement": {"verify", "idle"},
    "verify": {"simplify", "idle"},
    "simplify": {"done", "idle"},
    "done": {"idle"},
}

_NEXT_STAGE: dict[str, Optional[str]] = {
    "idle": "implement",
    "implement": "verify",
    "verify": "simplify",
    "simplify": "done",
    "done": None,
}


def set_stage(task_id: str, stage: str) -> bool:
    """Set the stage for a task. Validates the transition.

    Returns True if the transition was accepted, False if invalid
    or the task doesn't exist.
    """
    with _lock:
        task = _tasks.get(task_id)
        if task is None:
            return False
        current = task.get("stage", "idle")
        if current == stage:
            return True  # idempotent: already at this stage
        allowed = _VALID_TRANSITIONS.get(current, set())
        if stage not in allowed:
            return False
        task["stage"] = stage
        return True


def get_stage(task_id: str) -> Optional[str]:
    """Get the current stage of a task. Returns None if not found."""
    with _lock:
        task = _tasks.get(task_id)
        if task is None:
            return None
        return cast(Optional[str], task.get("stage", "idle"))


def get_next_stage(task_id: str) -> Optional[str]:
    """Get the next expected stage for a task.

    Returns None if the task is in its final stage or doesn't exist.
    """
    with _lock:
        task = _tasks.get(task_id)
        if task is None:
            return None
        current = task.get("stage", "idle")
        return _NEXT_STAGE.get(current)


def get_current_stage() -> Optional[str]:
    """Get the stage of the currently active task.

    Returns None if there is no active task.
    """
    with _lock:
        tid = _current_task_id
        if tid is None:
            return None
        task = _tasks.get(tid)
        if task is None:
            return None
        return cast(Optional[str], task.get("stage", "idle"))


# ── Active task tracking ───────────────────────────────────────────

_current_task_id: Optional[str] = None


def set_active_task(task_id: Optional[str]) -> None:
    """Set the currently active task (or clear with None).

    The active task is used by hooks to know which task to reference
    when injecting stage guidance.
    """
    global _current_task_id
    with _lock:
        _current_task_id = task_id


def get_active_task() -> Optional[dict[str, Any]]:
    """Get the currently active task record.

    Returns None if there is no active task or it no longer exists.
    """
    with _lock:
        tid = _current_task_id
        if tid is None:
            return None
        return _tasks.get(tid)


# ── Basic CRUD ─────────────────────────────────────────────────────


def create_task(project_dir: str, start_hash: str) -> str:
    """Create a new task record and return its task_id."""
    global _counter
    with _lock:
        _counter += 1
        task_id = f"jt-{int(time.time() * 1000)}-{_counter}"
        _tasks[task_id] = {
            "task_id": task_id,
            "project_dir": project_dir,
            "start_hash": start_hash,
            "created_at": time.time(),
            "stage": "idle",
        }
    return task_id


def get_task(task_id: str) -> Optional[dict[str, Any]]:
    """Look up a task by ID. Returns None if not found."""
    with _lock:
        return _tasks.get(task_id)


def task_count() -> int:
    """Return the number of active tasks."""
    with _lock:
        return len(_tasks)


def clear_tasks() -> int:
    """Remove all tasks. Also clears the active task reference.

    Returns the number removed.
    """
    global _current_task_id
    with _lock:
        n = len(_tasks)
        _tasks.clear()
        _current_task_id = None
        return n
