"""Tests for Jovaltus — state management and profile syncing logic."""

import json
from pathlib import Path

import pytest

import jovaltus.__init__ as jovaltus_mod


def test_load_state_empty(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Loading state when no file exists returns empty profiles dict."""
    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: tmp_path)
    state = jovaltus_mod._load_state()
    assert state == {"profiles": {}}


def test_load_state_invalid_json(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Loading state with invalid JSON returns empty profiles dict."""
    state_path = tmp_path / "jovaltus_state.json"
    state_path.write_text("not json")
    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: tmp_path)
    state = jovaltus_mod._load_state()
    assert state == {"profiles": {}}


def test_save_and_load_state(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Save then load preserves the original data."""
    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: tmp_path)
    jovaltus_mod._set_profile_state("jovaltus-agent", soul_md=True)
    state = jovaltus_mod._load_state()
    assert "jovaltus-agent" in state["profiles"]
    assert state["profiles"]["jovaltus-agent"]["soul_md"] is True
    assert "updated_at" in state["profiles"]["jovaltus-agent"]


def test_set_profile_state_skills_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Setting profile state without SOUL.md records skills_only."""
    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: tmp_path)
    jovaltus_mod._set_profile_state("jovaltus-agent", soul_md=False)
    state = jovaltus_mod._load_state()
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

    # Write a test SOUL.md in the plugin bundle
    plugin_dir = tmp_path / "plugin"
    plugin_dir.mkdir()
    (plugin_dir / "SOUL.md").write_text("# Jovaltus Agent")

    # Set up state
    state = {
        "profiles": {
            "jovaltus-agent": {"soul_md": True, "updated_at": "2025-01-01T00:00:00"}
        }
    }
    (fake_home / "jovaltus_state.json").write_text(json.dumps(state))

    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: fake_home)
    monkeypatch.setattr(jovaltus_mod, "_PLUGIN_DIR", plugin_dir)
    jovaltus_mod._sync_installed_profiles("test")

    # SOUL.md should have been written
    assert (profile_dir / "SOUL.md").exists()
    assert (profile_dir / "SOUL.md").read_text() == "# Jovaltus Agent"

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

    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: fake_home)
    monkeypatch.setattr(jovaltus_mod, "_PLUGIN_DIR", tmp_path / "plugin")
    jovaltus_mod._sync_installed_profiles("test")

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

    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: fake_home)
    monkeypatch.setattr(jovaltus_mod, "_PLUGIN_DIR", tmp_path / "plugin")
    jovaltus_mod._sync_installed_profiles("test")

    captured = capsys.readouterr().out
    assert "no longer exists — skipping" in captured


def test_sync_no_state(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Sync when no state exists shows helpful message."""
    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: tmp_path)
    jovaltus_mod._sync_installed_profiles("test")
    captured = capsys.readouterr().out
    assert "No profiles in installation state" in captured


def test_get_bundled_skill_names(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """_get_bundled_skill_names returns names of directories with SKILL.md."""
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir()
    (skills_dir / "good-skill").mkdir()
    (skills_dir / "good-skill" / "SKILL.md").write_text("# Good")
    (skills_dir / "empty-dir").mkdir()
    (skills_dir / "not-a-skill").mkdir()
    (skills_dir / "not-a-skill" / "readme.txt").write_text("nope")

    monkeypatch.setattr(jovaltus_mod, "_PLUGIN_DIR", tmp_path)
    names = jovaltus_mod._get_bundled_skill_names()
    assert names == {"good-skill"}


def test_remove_stale_skills(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Stale skills are removed interactively (non-TTY defaults to yes)."""
    fake_home = tmp_path / "hermes"
    skills_dir = fake_home / "skills"
    skills_dir.mkdir(parents=True)

    # Create an installed skill that is NOT in the bundle
    (skills_dir / "stale-skill").mkdir()
    (skills_dir / "stale-skill" / "SKILL.md").write_text("# Stale")
    # Create another that IS in the bundle
    (skills_dir / "fresh-skill").mkdir()
    (skills_dir / "fresh-skill" / "SKILL.md").write_text("# Fresh")

    monkeypatch.setattr(jovaltus_mod, "_get_global_hermes_home", lambda: fake_home)

    # Non-interactive mode (stdin not a TTY) defaults to yes → stale gets removed
    jovaltus_mod._remove_stale_skills({"fresh-skill"})

    assert not (skills_dir / "stale-skill").exists()
    assert (skills_dir / "fresh-skill").exists()

    captured = capsys.readouterr().out
    assert "Removed stale skill 'stale-skill'" in captured
