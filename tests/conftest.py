"""Shared fixtures for Jovaltus tests."""

import pytest

from jovaltus import state


@pytest.fixture(autouse=True)
def clear_task_state():
    """Reset task state before each test to avoid cross-test pollution."""
    state.clear_tasks()
    yield
