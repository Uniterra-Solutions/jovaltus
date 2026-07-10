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
    """clear_tasks should remove all tasks and return the count."""
    state.clear_tasks()
    assert state.task_count() == 0


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
