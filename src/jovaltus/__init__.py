"""Jovaltus plugin — registration entry point.

Called by Hermes at startup. Registers CLI commands and bundled skills
via Fabricium's HermesPlugin infrastructure.
"""

import logging
import subprocess
import sys
from pathlib import Path
from typing import Any


# Self-bootstrap: fabricium must be importable before the plugin can register
# CLI commands.  Hermes manages its own venv and may recreate it during updates,
# dropping plugin-only dependencies.  This guard ensures fabricium is installed
# on first import after a Hermes update without requiring a manual pip install.
def _ensure_fabricium() -> None:
    try:
        import fabricium  # noqa: F401
    except ImportError:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "fabricium"],
            check=True,
            capture_output=True,
        )
        # Clear stale import cache from the failed attempt above
        sys.modules.pop("fabricium", None)


_ensure_fabricium()

from fabricium import HermesPlugin  # noqa: E402

# Relative import: Hermes loads directory plugins as ``hermes_plugins.jovaltus``
# (importlib spec with the plugin dir as __path__), where the top-level
# ``jovaltus`` name is NOT importable — absolute self-imports fail there.
from .setup_config import ensure_max_spawn_depth  # noqa: E402

logger = logging.getLogger(__name__)

_PLUGIN_DIR = Path(__file__).parent


# The execute pipeline's orchestrator subagent spawns worker subagents, so it
# needs delegation.max_spawn_depth >= 2. Subclassing HermesPlugin lets setup
# and update auto-configure the profile config instead of leaving the user to
# hit an execute error ("execute requires delegation.max_spawn_depth >= 2").
class _JovaltusPlugin(HermesPlugin):
    def _configure_max_spawn_depth_for_profiles(self) -> None:
        """Ensure every installed profile's config meets the execute floor."""
        profiles = set(self._load_state().get("profiles", {}))
        if self.default_profile:
            profiles.add(self.default_profile)
        for profile_name in sorted(profiles):
            profile_dir = self._get_profile_dir(profile_name)
            if not profile_dir.exists() or not (profile_dir / "config.yaml").exists():
                continue
            if ensure_max_spawn_depth(profile_dir):
                print(
                    f"  ⚙️  delegation.max_spawn_depth ensured in profile "
                    f"'{profile_name}'"
                )
            else:
                print(
                    f"  ! could not configure delegation.max_spawn_depth for "
                    f"profile '{profile_name}'"
                )

    def _setup_command(self, args: Any) -> None:
        super()._setup_command(args)
        self._configure_max_spawn_depth_for_profiles()

    def _update_pull(self, args: Any) -> None:
        super()._update_pull(args)
        self._configure_max_spawn_depth_for_profiles()


plugin = _JovaltusPlugin(
    name="jovaltus",
    plugin_dir=_PLUGIN_DIR,
    default_profile="jovaltus-agent",
)


def register(ctx: Any) -> None:
    """Register CLI commands, bundled skills, pipeline tools, and hooks.

    Fabricium's ``plugin.register(ctx)`` handles:
    - CLI: ``hermes jovaltus setup|status|update|update --check``
    - Bundled skills from ``skills/``
    ``tools.register(ctx)`` then registers the four pipeline tools (plan /
    execute / simplify / review) and the four hook callbacks (subagent_start
    / subagent_stop / pre_llm_call / post_llm_call) per Contract §6.
    """
    plugin.register(ctx)

    from jovaltus import hooks as jovaltus_hooks
    from jovaltus import tools as jovaltus_tools

    jovaltus_tools.register(ctx)
    jovaltus_hooks.init(ctx)
    ctx.register_hook("subagent_start", jovaltus_hooks.on_subagent_start)
    ctx.register_hook("subagent_stop", jovaltus_hooks.on_subagent_stop)
    ctx.register_hook("pre_llm_call", jovaltus_hooks.on_pre_llm_call)
    ctx.register_hook("post_llm_call", jovaltus_hooks.on_post_llm_call)

    logger.info("Jovaltus registered (via Fabricium)")
