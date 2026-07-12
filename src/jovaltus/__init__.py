"""Jovaltus plugin — registration entry point.

Called by Hermes at startup. Creates handler closures that capture ctx,
then registers them as tools. Also registers CLI commands and bundled skills
via Fabricium's HermesPlugin infrastructure.
"""

import logging
from pathlib import Path
from typing import Any

from fabricium import HermesPlugin

from . import hooks, schemas
from .tools import make_implement_handler, make_verify_handler, make_simplify_handler

logger = logging.getLogger(__name__)

_PLUGIN_DIR = Path(__file__).parent

plugin = HermesPlugin(
    name="jovaltus",
    plugin_dir=_PLUGIN_DIR,
    default_profile="jovaltus-agent",
)


def register(ctx: Any) -> None:
    """Wire schemas to handler closures, register CLI, skills, tools and hooks.

    Fabricium's ``plugin.register(ctx)`` handles:
    - CLI: ``hermes jovaltus setup|status|update|update --check``
    - Bundled skills from ``skills/``

    The rest is Jovaltus-unique: three pipeline tools + stage-tracking hooks.
    """
    # ── CLI + bundled skills (Fabricium) ──────────────────────────
    plugin.register(ctx)

    # ── Tools (closures capturing ctx) ────────────────────────────
    ctx.register_tool(
        name="jovaltus_implement",
        toolset="jovaltus",
        schema=schemas.IMPLEMENT_SCHEMA,
        handler=make_implement_handler(ctx),
    )
    ctx.register_tool(
        name="jovaltus_verify",
        toolset="jovaltus",
        schema=schemas.VERIFY_SCHEMA,
        handler=make_verify_handler(ctx),
    )
    ctx.register_tool(
        name="jovaltus_simplify",
        toolset="jovaltus",
        schema=schemas.SIMPLIFY_SCHEMA,
        handler=make_simplify_handler(ctx),
    )

    # ── Hooks (stage tracking & guidance) ─────────────────────────
    ctx.register_hook("post_tool_call", hooks.on_post_tool_call)
    ctx.register_hook("pre_llm_call", hooks.on_pre_llm_call)

    logger.info("Jovaltus registered (via Fabricium)")
