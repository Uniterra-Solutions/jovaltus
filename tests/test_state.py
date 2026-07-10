"""Tests for Jovaltus plugin — task state management."""

import threading

from jovaltus import state


def test_create_and_get():
    """A created task should be retrievable by task_id."""
    tid = state.create_task("/tmp/project", "abc123def")
    task = state.get_task(tid)
    assert task is not None
    assert task["task_id"] == tid
    assert task["project_dir"] == "/tmp/project"
    assert task["start_hash"] == "abc123def"
    assert "created_at" in task


def test_get_nonexistent():
    """Looking up a non-existent task should return None."""
    task = state.get_task("nonexistent")
    assert task is None


def test_task_ids_are_unique():
    """Each create_task call should produce a unique task_id."""
    t1 = state.create_task("/a", "aaa")
    t2 = state.create_task("/b", "bbb")
    assert t1 != t2


def test_count():
    """task_count should reflect the number of active tasks."""
    before = state.task_count()
    state.create_task("/x", "xxx")
    state.create_task("/y", "yyy")
    assert state.task_count() == before + 2


def test_clear():
    """clear_tasks should remove all tasks and reset active task."""
    state.clear_tasks()
    assert state.task_count() == 0
    assert state.get_active_task() is None


def test_thread_safety():
    """Concurrent create_task calls should not corrupt state."""
    state.clear_tasks()
    n = 50
    errors = []

    def create(i):
        try:
            state.create_task(f"/proj-{i}", f"hash-{i}")
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=create, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Thread safety errors: {errors}"
    assert state.task_count() == n


# ── Stage machine tests ───────────────────────────────────────────


def test_initial_stage_is_idle():
    """A newly created task should start in idle stage."""
    tid = state.create_task("/p", "h1")
    assert state.get_stage(tid) == "idle"


def test_full_pipeline_transition():
    """A task should progress through all pipeline stages."""
    tid = state.create_task("/p", "h1")
    assert state.get_stage(tid) == "idle"

    assert state.set_stage(tid, "implement")
    assert state.get_stage(tid) == "implement"

    assert state.set_stage(tid, "verify")
    assert state.get_stage(tid) == "verify"

    assert state.set_stage(tid, "simplify")
    assert state.get_stage(tid) == "simplify"

    assert state.set_stage(tid, "done")
    assert state.get_stage(tid) == "done"


def test_invalid_transition_rejected():
    """Jumping stages should be rejected (e.g. idle -> verify)."""
    tid = state.create_task("/p", "h1")
    assert state.set_stage(tid, "verify") is False
    assert state.get_stage(tid) == "idle"


def test_set_stage_nonexistent_task():
    """set_stage on a non-existent task should return False."""
    assert state.set_stage("nonexistent", "implement") is False


def test_get_stage_nonexistent():
    """get_stage on a non-existent task should return None."""
    assert state.get_stage("nonexistent") is None


def test_get_next_stage():
    """get_next_stage should return the expected next stage."""
    tid = state.create_task("/p", "h1")
    assert state.get_next_stage(tid) == "implement"

    state.set_stage(tid, "implement")
    assert state.get_next_stage(tid) == "verify"

    state.set_stage(tid, "verify")
    assert state.get_next_stage(tid) == "simplify"

    state.set_stage(tid, "simplify")
    assert state.get_next_stage(tid) == "done"

    state.set_stage(tid, "done")
    assert state.get_next_stage(tid) is None


def test_get_next_stage_nonexistent():
    """get_next_stage on a non-existent task should return None."""
    assert state.get_next_stage("nonexistent") is None


def test_idempotent_set_stage():
    """Setting the same stage should be a no-op (not rejected)."""
    tid = state.create_task("/p", "h1")
    assert state.set_stage(tid, "idle") is True
    assert state.get_stage(tid) == "idle"


def test_active_task_tracking():
    """set_active_task / get_active_task should work correctly."""
    assert state.get_active_task() is None

    tid = state.create_task("/p", "h1")
    state.set_active_task(tid)
    task = state.get_active_task()
    assert task is not None
    assert task["task_id"] == tid

    state.set_active_task(None)
    assert state.get_active_task() is None


def test_get_current_stage():
    """get_current_stage should return stage of the active task."""
    assert state.get_current_stage() is None

    tid = state.create_task("/p", "h1")
    state.set_active_task(tid)
    assert state.get_current_stage() == "idle"

    state.set_stage(tid, "implement")
    assert state.get_current_stage() == "implement"


def test_reset_via_idle_transition():
    """A task in any stage should be resettable back to idle."""
    tid = state.create_task("/p", "h1")
    state.set_stage(tid, "implement")
    state.set_stage(tid, "verify")
    state.set_stage(tid, "simplify")
    state.set_stage(tid, "done")

    # Reset back to idle
    assert state.set_stage(tid, "idle")
    assert state.get_stage(tid) == "idle"
    assert state.get_next_stage(tid) == "implement"
