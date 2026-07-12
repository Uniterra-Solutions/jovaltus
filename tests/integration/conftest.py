"""Integration tests for Jovaltus CLI in a real Hermes environment.

Jovaltus is a **single-profile** plugin (``default_profile="jovaltus-agent"``).
Uses fabricium's test infrastructure (Docker + Hermes).
"""

import os
from pathlib import Path

# ── Must be set *before* importing the fixture ──────────────────────
os.environ["FABRICIUM_TEST_PLUGIN_NAME"] = "jovaltus"
os.environ["FABRICIUM_TEST_PLUGIN_DIR"] = str(Path(__file__).parent.parent.parent)
# Mount fabricium source for editable install in the container
os.environ["FABRICIUM_TEST_FABRICIUM_SRC"] = str(
    Path(__file__).parent.parent.parent.parent / "fabricium"
)

from fabricium.testing.fixtures import hermes_config, hermes_test_env  # noqa: E402

__all__ = ["hermes_config", "hermes_test_env"]
