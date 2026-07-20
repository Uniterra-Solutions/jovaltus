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

logger = logging.getLogger(__name__)

_PLUGIN_DIR = Path(__file__).parent

plugin = HermesPlugin(
    name="jovaltus",
    plugin_dir=_PLUGIN_DIR,
    default_profile="jovaltus-agent",
)


def register(ctx: Any) -> None:
    """Register CLI commands and bundled skills.

    Fabricium's ``plugin.register(ctx)`` handles:
    - CLI: ``hermes jovaltus setup|status|update|update --check``
    - Bundled skills from ``skills/``
    """
    plugin.register(ctx)

    logger.info("Jovaltus registered (via Fabricium)")
