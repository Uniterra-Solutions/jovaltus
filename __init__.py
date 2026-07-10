"""Jovaltus plugin — registration entry point.

Called by Hermes at startup. Creates handler closures that capture ctx,
then registers them as tools. Also registers CLI commands and bundled skills.
"""

import logging
import subprocess
from pathlib import Path

from . import schemas
from .tools import make_implement_handler, make_verify_handler, make_simplify_handler

logger = logging.getLogger(__name__)

_PLUGIN_DIR = Path(__file__).parent


def _setup_command(args) -> None:
    """Handler for 'hermes jovaltus setup'.

    Creates the jovaltus-agent profile if it doesn't exist
    and confirms the plugin is ready.
    """
    import os

    profile_name = "jovaltus-agent"
    profiles_dir = Path(os.environ.get(
        "HERMES_HOME", Path.home() / ".hermes"
    )) / "profiles"
    profile_dir = profiles_dir / profile_name

    if profile_dir.exists():
        print(f"✓ Profile '{profile_name}' already exists at {profile_dir}")
    else:
        print(f"Creating profile '{profile_name}'...")
        try:
            subprocess.run(
                ["hermes", "profile", "create", profile_name],
                check=True, capture_output=True, text=True,
            )
            print(f"✓ Profile '{profile_name}' created")
        except subprocess.CalledProcessError as e:
            print(f"! Could not auto-create profile: {e.stderr.strip()}")
            print(f"  Create it manually: hermes profile create {profile_name}")
        except FileNotFoundError:
            print("! 'hermes' CLI not found on PATH")
            print(f"  Create the profile manually: hermes profile create {profile_name}")

    print("✓ Jovaltus plugin v0.1.0 ready")
    print(f"  Start a session: hermes -p {profile_name}")
    print("  Enable tools:    hermes tools enable jovaltus  (if not auto-enabled)")


def _setup_argparse(subparser):
    """Build argparse subcommand tree for 'hermes jovaltus'."""
    subs = subparser.add_subparsers(dest="jovaltus_command")
    subs.add_parser("setup", help="Create jovaltus-agent profile and verify setup")
    subparser.set_defaults(func=_setup_command)


def register(ctx):
    """Wire schemas to handler closures, register CLI commands and skills.

    Called exactly once at Hermes startup. Each tool handler is a closure
    that captures ctx so it can call ctx.dispatch_tool("delegate_task", ...)
    to spawn subagents with the appropriate system prompts.
    """
    # ── Tools (closures capturing ctx) ───────────────────────────────
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

    # ── CLI commands ─────────────────────────────────────────────────
    ctx.register_cli_command(
        name="jovaltus",
        help="Jovaltus plugin — setup and management",
        setup_fn=_setup_argparse,
        handler_fn=_setup_command,
    )

    # ── Bundled skills (namespaced, read-only) ───────────────────────
    skills_dir = _PLUGIN_DIR / "skills"
    if skills_dir.is_dir():
        for child in sorted(skills_dir.iterdir()):
            skill_md = child / "SKILL.md"
            if child.is_dir() and skill_md.exists():
                ctx.register_skill(child.name, skill_md)
                logger.info("Registered bundled skill: jovaltus:%s", child.name)
