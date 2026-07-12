"""Tests for Jovaltus — state management and profile syncing logic.

Now that Jovaltus uses Fabricium for plugin lifecycle, these tests
exercise Fabricium's state/skills modules and Jovaltus's plugin instance.
"""

import json
from pathlib import Path

import pytest

import fabricium.state as fstate
import jovaltus


def test_load_state_empty(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Loading state when no file exists returns empty profiles dict."""
    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: tmp_path)
    state = fstate.load_state("jovaltus")
    assert state == {"profiles": {}}


def test_load_state_invalid_json(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Loading state with invalid JSON returns empty profiles dict."""
    state_path = tmp_path / "jovaltus_state.json"
    state_path.write_text("not json")
    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: tmp_path)
    state = fstate.load_state("jovaltus")
    assert state == {"profiles": {}}


def test_save_and_load_state(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Save then load preserves the original data."""
    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: tmp_path)
    fstate.set_profile_state("jovaltus", "jovaltus-agent", soul_md=True)
    state = fstate.load_state("jovaltus")
    assert "jovaltus-agent" in state["profiles"]
    assert state["profiles"]["jovaltus-agent"]["soul_md"] is True
    assert "updated_at" in state["profiles"]["jovaltus-agent"]


def test_set_profile_state_skills_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Setting profile state without SOUL.md records skills_only."""
    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: tmp_path)
    fstate.set_profile_state("jovaltus", "jovaltus-agent", soul_md=False)
    state = fstate.load_state("jovaltus")
    assert state["profiles"]["jovaltus-agent"]["soul_md"] is False


def test_sync_updates_soul_md(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Sync re-applies SOUL.md for profiles tracked with soul_md=True."""
    fake_home = tmp_path / "hermes"
    fake_home.mkdir()
    profile_dir = fake_home / "profiles" / "jovaltus-agent"
    profile_dir.mkdir(parents=True)
    (profile_dir / "config.yaml").write_text("")

    state = {
        "profiles": {
            "jovaltus-agent": {"soul_md": True, "updated_at": "2025-01-01T00:00:00"}
        }
    }
    (fake_home / "jovaltus_state.json").write_text(json.dumps(state))

    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: fake_home)
    jovaltus.plugin._sync_installed_profiles("test")

    # SOUL.md should have been written by Fabricium's HermesPlugin
    assert (profile_dir / "SOUL.md").exists()
    captured = capsys.readouterr().out
    assert "Updating SOUL.md" in captured


def test_sync_skills_only_no_soul(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Sync for skills-only profiles does not re-apply SOUL.md."""
    fake_home = tmp_path / "hermes"
    fake_home.mkdir()
    profile_dir = fake_home / "profiles" / "jovaltus-agent"
    profile_dir.mkdir(parents=True)
    (profile_dir / "config.yaml").write_text("")

    state = {
        "profiles": {
            "jovaltus-agent": {"soul_md": False, "updated_at": "2025-01-01T00:00:00"}
        }
    }
    (fake_home / "jovaltus_state.json").write_text(json.dumps(state))

    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: fake_home)
    jovaltus.plugin._sync_installed_profiles("test")

    captured = capsys.readouterr().out
    assert "Skills only (SOUL.md not tracked)" in captured


def test_sync_skips_missing_profile(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Sync skips profiles whose directories no longer exist."""
    fake_home = tmp_path / "hermes"
    fake_home.mkdir()
    # No profile dir created
    state = {
        "profiles": {
            "jovaltus-agent": {"soul_md": True, "updated_at": "2025-01-01T00:00:00"}
        }
    }
    (fake_home / "jovaltus_state.json").write_text(json.dumps(state))

    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: fake_home)
    jovaltus.plugin._sync_installed_profiles("test")

    captured = capsys.readouterr().out
    assert "no longer exists — skipping" in captured


def test_sync_no_state(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Sync when no state exists shows helpful message."""
    monkeypatch.setattr(fstate, "_get_global_hermes_home", lambda: tmp_path)
    jovaltus.plugin._sync_installed_profiles("test")
    captured = capsys.readouterr().out
    assert "No profiles in installation state" in captured
