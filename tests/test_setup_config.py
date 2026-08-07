"""Unit tests for the setup/update auto-configuration (Contract §6 amendment).

Covers the text-based YAML transformer in :mod:`jovaltus.setup_config` and
the HermesPlugin subclass wiring in :mod:`jovaltus` that runs it after
``hermes jovaltus setup`` / ``hermes jovaltus update``.
"""

from pathlib import Path

import pytest

from jovaltus import _JovaltusPlugin, setup_config


# ── text transformer ─────────────────────────────────────────────────────────


def test_no_delegation_block_appends_one() -> None:
    text = "provider:\n  api_key: abc\n"
    out = setup_config._ensure_max_spawn_depth_text(text, 2)
    assert out == ("provider:\n  api_key: abc\n\ndelegation:\n  max_spawn_depth: 2\n")


def test_bumps_low_value() -> None:
    text = "delegation:\n  model: ''\n  max_spawn_depth: 1\n"
    out = setup_config._ensure_max_spawn_depth_text(text, 2)
    assert "  max_spawn_depth: 2\n" in out
    assert "  model: ''" in out  # sibling keys preserved
    assert out.count("max_spawn_depth") == 1


def test_keeps_sufficient_value() -> None:
    text = "delegation:\n  max_spawn_depth: 5\n  model: x\n"
    assert setup_config._ensure_max_spawn_depth_text(text, 2) == text


def test_inserts_missing_key_in_block() -> None:
    text = "delegation:\n  model: ''\n  max_iterations: 50\n"
    out = setup_config._ensure_max_spawn_depth_text(text, 2)
    lines = out.splitlines()
    assert "  max_spawn_depth: 2" in lines
    assert "  model: ''" in lines
    assert "  max_iterations: 50" in lines


def test_expands_inline_header() -> None:
    text = "delegation: {}\n"
    out = setup_config._ensure_max_spawn_depth_text(text, 2)
    assert "delegation:\n  max_spawn_depth: 2\n" in out


def test_preserves_other_top_level_keys_and_comments() -> None:
    text = (
        "# top comment\n"
        "model: deepseek\n"
        "delegation:\n"
        "  # delegation settings\n"
        "  max_spawn_depth: 1\n"
        "logging:\n"
        "  level: info\n"
    )
    out = setup_config._ensure_max_spawn_depth_text(text, 2)
    assert "# top comment" in out
    assert "model: deepseek" in out
    assert "# delegation settings" in out
    assert "  max_spawn_depth: 2" in out
    assert "logging:\n  level: info" in out


def test_comment_on_value_line_is_replaced() -> None:
    text = "delegation:\n  max_spawn_depth: 1  # floor\n"
    out = setup_config._ensure_max_spawn_depth_text(text, 2)
    assert "  max_spawn_depth: 2" in out
    assert "floor" not in out  # comment on the replaced line is dropped


# ── file-level helper ────────────────────────────────────────────────────────


def test_ensure_max_spawn_depth_writes_file(tmp_path: Path) -> None:
    cfg = tmp_path / "config.yaml"
    cfg.write_text("delegation:\n  max_spawn_depth: 1\n", encoding="utf-8")
    assert setup_config.ensure_max_spawn_depth(tmp_path) is True
    assert "  max_spawn_depth: 2" in cfg.read_text(encoding="utf-8")


def test_ensure_max_spawn_depth_sufficient_is_noop(tmp_path: Path) -> None:
    cfg = tmp_path / "config.yaml"
    original = "delegation:\n  max_spawn_depth: 4\n"
    cfg.write_text(original, encoding="utf-8")
    assert setup_config.ensure_max_spawn_depth(tmp_path) is True
    assert cfg.read_text(encoding="utf-8") == original


def test_ensure_max_spawn_depth_missing_file_is_false(tmp_path: Path) -> None:
    assert setup_config.ensure_max_spawn_depth(tmp_path / "nope") is False


# ── HermesPlugin subclass wiring ─────────────────────────────────────────────


def test_plugin_configure_runs_for_installed_profiles(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """_configure_max_spawn_depth_for_profiles edits each installed profile."""
    profile_dir = tmp_path / "profiles" / "jovaltus-agent"
    profile_dir.mkdir(parents=True)
    (profile_dir / "config.yaml").write_text(
        "delegation:\n  max_spawn_depth: 1\n", encoding="utf-8"
    )

    plugin = _JovaltusPlugin(
        name="jovaltus", plugin_dir=tmp_path, default_profile="jovaltus-agent"
    )
    monkeypatch.setattr(
        plugin, "_load_state", lambda: {"profiles": {"jovaltus-agent": {}}}
    )
    monkeypatch.setattr(
        plugin, "_get_profile_dir", lambda name: tmp_path / "profiles" / name
    )

    plugin._configure_max_spawn_depth_for_profiles()

    assert "  max_spawn_depth: 2" in (profile_dir / "config.yaml").read_text(
        encoding="utf-8"
    )


def test_plugin_configure_skips_missing_profile(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Profiles without a config.yaml are skipped, not crashed on."""
    plugin = _JovaltusPlugin(
        name="jovaltus", plugin_dir=tmp_path, default_profile="jovaltus-agent"
    )
    monkeypatch.setattr(plugin, "_load_state", lambda: {"profiles": {"ghost": {}}})
    monkeypatch.setattr(
        plugin, "_get_profile_dir", lambda name: tmp_path / "profiles" / name
    )

    plugin._configure_max_spawn_depth_for_profiles()  # must not raise
