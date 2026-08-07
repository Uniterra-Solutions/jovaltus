"""Tests for the plugin registration wiring (Contract §6).

``jovaltus.register(ctx)`` must keep Fabricium's CLI + bundled-skill
registration intact and additionally register exactly the four pipeline
tools and the three hook callbacks — with no exceptions.
"""

from typing import Any

import jovaltus
from jovaltus import hooks, tools

_PLAN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"user_requirements": {"type": "string"}},
    "required": ["user_requirements"],
}
_PLAN_PATH_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"plan": {"type": "string"}},
    "required": ["plan"],
}
# Contract §1 + E2E fix: schemas are wrapped in the OpenAI "parameters"
# envelope so model_tools.py can read schema["parameters"]["properties"].
_WRAPPED_PLAN_SCHEMA: dict[str, Any] = {"parameters": _PLAN_SCHEMA}
_WRAPPED_PLAN_PATH_SCHEMA: dict[str, Any] = {"parameters": _PLAN_PATH_SCHEMA}


class FakeCtx:
    """Records everything a plugin can register."""

    def __init__(self) -> None:
        self.cli_commands: list[str] = []
        self.skills: list[str] = []
        self.tools: list[dict[str, Any]] = []
        self.hooks: list[tuple[str, Any]] = []

    def register_cli_command(
        self,
        name: str,
        help: str,
        setup_fn: Any = None,
        handler_fn: Any = None,
        description: str = "",
    ) -> None:
        self.cli_commands.append(name)

    def register_skill(self, name: str, path: Any) -> None:
        self.skills.append(name)

    def register_tool(
        self,
        name: str,
        toolset: str,
        schema: dict[str, Any],
        handler: Any,
        **kwargs: Any,
    ) -> None:
        entry: dict[str, Any] = {
            "name": name,
            "toolset": toolset,
            "schema": schema,
            "handler": handler,
        }
        entry.update(kwargs)
        self.tools.append(entry)

    def register_hook(self, hook_name: str, callback: Any) -> None:
        self.hooks.append((hook_name, callback))


def _register() -> FakeCtx:
    ctx = FakeCtx()
    jovaltus.register(ctx)  # must not raise
    return ctx


def test_register_keeps_fabricium_cli_and_skills() -> None:
    ctx = _register()
    assert ctx.cli_commands == ["jovaltus"]
    assert ctx.skills, "bundled skills were not registered"


def test_register_registers_exactly_four_tools() -> None:
    ctx = _register()
    names = [t["name"] for t in ctx.tools]
    assert names == ["plan", "execute", "simplify", "review"]

    by_name = {t["name"]: t for t in ctx.tools}
    for tool in ("plan", "execute", "simplify", "review"):
        entry = by_name[tool]
        assert entry["toolset"] == "jovaltus"
        assert entry["is_async"] is False
        assert "description" in entry and entry["description"]

    assert by_name["plan"]["schema"] == _WRAPPED_PLAN_SCHEMA
    assert by_name["plan"]["handler"] is tools.plan_handler
    for tool in ("execute", "simplify", "review"):
        assert by_name[tool]["schema"] == _WRAPPED_PLAN_PATH_SCHEMA
    assert by_name["execute"]["handler"] is tools.execute_handler
    assert by_name["simplify"]["handler"] is tools.simplify_handler
    assert by_name["review"]["handler"] is tools.review_handler


def test_register_registers_exactly_three_hooks() -> None:
    ctx = _register()
    names = [name for name, _ in ctx.hooks]
    assert names == ["subagent_start", "subagent_stop", "pre_llm_call"]

    by_name = dict(ctx.hooks)
    assert by_name["subagent_start"] is hooks.on_subagent_start
    assert by_name["subagent_stop"] is hooks.on_subagent_stop
    assert by_name["pre_llm_call"] is hooks.on_pre_llm_call


def test_register_descriptions_contain_contract_prefixes() -> None:
    ctx = _register()
    by_name = {t["name"]: t for t in ctx.tools}
    # Each description must state its USE WHEN scenario so the main agent
    # can route requests to the right tool.
    assert by_name["plan"]["description"].startswith("USE WHEN:")
    assert "implementation plan" in by_name["plan"]["description"]
    assert by_name["execute"]["description"].startswith("USE WHEN:")
    assert "implement the" in by_name["execute"]["description"]
    assert by_name["simplify"]["description"].startswith("USE WHEN:")
    assert "simplified" in by_name["simplify"]["description"]
    assert by_name["review"]["description"].startswith("USE WHEN:")
    assert "reviewed" in by_name["review"]["description"]
    # All four reference the plan artifact / path to keep the chain obvious.
    for tool in ("plan", "execute", "simplify", "review"):
        assert by_name[tool]["description"]


def test_register_can_be_called_twice() -> None:
    """Re-registration (plugin reload) is idempotent and exception-free."""
    ctx = FakeCtx()
    jovaltus.register(ctx)
    jovaltus.register(ctx)
    assert [t["name"] for t in ctx.tools] == [
        "plan",
        "execute",
        "simplify",
        "review",
        "plan",
        "execute",
        "simplify",
        "review",
    ]
