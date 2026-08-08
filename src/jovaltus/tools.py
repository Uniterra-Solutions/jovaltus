"""Jovaltus tool handlers — dispatch pipeline subagents.

Each handler starts a deterministic pipeline in :mod:`jovaltus.state` and
fires the first phase subagent via ``subagent_lifecycle`` (see
:func:`dispatch_pipeline_step`).
The remaining phases are driven by the hooks in :mod:`jovaltus.hooks`, which
import :func:`dispatch_pipeline_step` from this module — no circular import,
because ``tools.py`` depends only on ``state.py`` and ``prompts``.

Handler invocation contract (Contract §1): ``handler(args, **kwargs) -> str``
where ``args`` is the tool-call arguments dict and the return value is a JSON
string.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from jovaltus import state as jstate
from jovaltus.prompts import load_prompt

logger = logging.getLogger(__name__)

# Captured at register() time — the registry invokes handlers without ctx.
_CTX: Any = None

# The host parent agent per originating session, resolved lazily and cached
# across dispatch calls. subagent_lifecycle resolves the parent from a
# contextvar that Hermes binds only around a main-agent turn; subagent_stop /
# post_llm_call hook callbacks run on child daemon threads where that
# contextvar is NOT visible. Keying the cache by the parent's session_id
# (instead of a single process-global slot) means a hook-driven re-dispatch
# re-attaches to the session that OWNS the pipeline — not whichever session
# happened to dispatch last — so the subagent's progress events (and the
# desktop subagent rows they drive) land in the right session's chat.
_PARENT_AGENTS: dict[str, Any] = {}
# Last-resort fallback for pipelines whose session never went through a
# main-turn dispatch (e.g. legacy state resumed without new captures).
_PARENT_AGENT: Any = None

# Routing metadata for completion notifications. Captured per-run on the
# main-turn dispatch (where the contextvar parent and session env are bound)
# and PERSISTED on the pipeline (state.PipelineState.session_key /
# origin_ui_session_id), so hook-driven notifications — which fire on child
# daemon threads where those contextvars are NOT visible — still land in the
# session that started the pipeline even when other parallel sessions run
# their own pipelines in the same gateway process. Mirrors the
# process_registry completion-event contract; see _capture_routing.


def _get_parent_agent(session_key: str = "") -> Any:
    """Return the host parent for *session_key*'s pipeline.

    On a main-agent turn the contextvar parent is live (via
    :func:`_live_parent`): record it in the per-session cache and return it.
    On a hook's daemon thread the contextvar is invisible, so resolve by the
    pipeline's OWN session key — never the last session that happened to
    dispatch.
    """
    global _PARENT_AGENT
    live = _live_parent()
    if live is not None:
        _PARENT_AGENT = live
        sid = getattr(live, "session_id", None)
        if sid:
            _PARENT_AGENTS[str(sid)] = live
        return live
    if session_key and session_key in _PARENT_AGENTS:
        return _PARENT_AGENTS[session_key]
    return _PARENT_AGENT


def _live_parent() -> Any:
    """The contextvar-bound parent of THIS execution context, or None.

    Present only inside a main-agent turn. Hook dispatches run on child
    daemon threads where the contextvar is not visible, so callers use this
    to distinguish "capture routing now" from "keep the existing snapshot".
    """
    try:
        from agent.subagent_lifecycle import get_active_subagent_parent

        return get_active_subagent_parent()
    except Exception:  # noqa: BLE001 — no Hermes runtime (CI)
        return None


def _capture_routing() -> dict[str, str]:
    """Capture the originating session's routing metadata (main turn only).

    Returns ``{"session_key": <agent session_id>, "origin_ui_session_id":
    <UI tab id>}`` — empty strings on a daemon thread or outside a Hermes
    runtime. Also records the parent agent in the per-session cache so
    hook-driven re-dispatches can resolve the right parent. The returned
    dict is persisted on the pipeline by the tool handlers, making each
    run's notifications addressable to the session that started it.
    """
    routing: dict[str, str] = {"session_key": "", "origin_ui_session_id": ""}
    parent = _live_parent()
    if parent is None:
        return routing
    session_id = getattr(parent, "session_id", None)
    if session_id:
        routing["session_key"] = str(session_id)
        _PARENT_AGENTS[str(session_id)] = parent
    try:
        from gateway.session_context import get_session_env

        ui_session = get_session_env("HERMES_UI_SESSION_ID", "")
    except Exception:  # noqa: BLE001 — CI / non-gateway fallback
        ui_session = os.environ.get("HERMES_UI_SESSION_ID", "")
    if ui_session:
        routing["origin_ui_session_id"] = str(ui_session)
    return routing


def _get_lifecycle(session_key: str = "") -> Any:
    """A SubagentLifecycleService whose parent resolver falls back to cache.

    ``ctx.subagent_lifecycle`` is the official entry point, but its resolver
    only reads the turn-bound contextvar — unavailable on the daemon thread
    where ``subagent_stop`` / ``post_llm_call`` fire. Rebuilding the same
    public service with a resolver bound to the pipeline's session keeps the
    launch/handle/hook contract identical while re-attaching hook-driven
    dispatches to the owning session.
    """
    from agent.subagent_lifecycle import SubagentLifecycleService

    return SubagentLifecycleService(lambda: _get_parent_agent(session_key))


_TOOLSET = "jovaltus"

_VALID_TOOLS: tuple[str, ...] = ("plan", "execute", "simplify", "review")

# Literal placeholder every prompt carries (Contract §4); substituted with the
# real ``[jovaltus-pipeline:<tool>:<phase>]`` marker by :func:`_render_prompt`.
_MARKER_PLACEHOLDER = "[jovaltus-pipeline:TOOL:PHASE]"

# Prompt name per pipeline phase (Contract §4).
_PHASE_PROMPTS: dict[str, str] = {
    "prd": "prd",
    "research": "research",
    "acceptance": "acceptance",
    "tasks": "tasks",
    "execute": "execute",
    "simplify": "simplify-review",
    "review": "review",
}

# Contract §3 chain table: phase -> next phase. The simplify/review reviewer
# legs are verdict-driven (hooks.py reads verdict.json before following the
# "simplify" -> "simplify_waiting" / "review" -> "review_waiting" edges).
# The waiting phases dispatch NO subagent: the main agent performs the fixes
# itself (no subagent iteration cap), and the post_llm_call hook re-dispatches
# the reviewer when the main agent's fixing turn ends (hooks.py:on_post_llm_call).
CHAIN: dict[str, dict[str, str]] = {
    "plan": {
        "prd": "research",
        "research": "acceptance",
        "acceptance": "tasks",
        "tasks": "done",
    },
    "execute": {"execute": "done"},
    "simplify": {"simplify": "simplify_waiting", "simplify_waiting": "simplify"},
    "review": {"review": "review_waiting", "review_waiting": "review"},
}

# Contract §1 schemas (properties + required).  MUST wrap in "parameters" —
# model_tools.py reads schema.get("parameters").get("properties") when building
# the model-facing tool definition (verified hermes-agent/model_tools.py:742);
# without the wrapper the agent sees a parameter-less tool.
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


def _wrap_schema(inner: dict[str, Any]) -> dict[str, Any]:
    """Wrap a raw parameters object in the OpenAI ``parameters`` envelope.

    Hermes reads ``schema.get("parameters")`` (model_tools.py:742) — the
    OpenAI function-call shape is ``{"parameters": {"type": "object",
    "properties": ..., "required": [...]}}`` with no top-level ``type``
    (verified against delegate_task's own schema, delegate_tool.py:3774).
    """
    return {"parameters": inner}


# ── Registration -----------------------------------------------------------


def register(ctx: Any) -> None:
    """Register the four pipeline tools (Contract §1)."""
    global _CTX
    _CTX = ctx
    ctx.register_tool(
        "plan",
        _TOOLSET,
        _wrap_schema(_PLAN_SCHEMA),
        plan_handler,
        is_async=False,
        description=(
            "USE WHEN: the user has a software-engineering request and wants "
            "it turned into an implementation plan — or has a complex "
            "software-engineering request that needs planning. Dispatches "
            "the Jovaltus planning pipeline in sequence (PRD → research → "
            "acceptance → task DAG), each phase as an isolated subagent, "
            "and writes the artifacts into <repo_root>/.plan/<date>/<name>/. "
            "Requires user_requirements."
        ),
        emoji="📋",
    )
    ctx.register_tool(
        "execute",
        _TOOLSET,
        _wrap_schema(_PLAN_PATH_SCHEMA),
        execute_handler,
        is_async=False,
        description=(
            "USE WHEN: a plan exists and you want to implement the "
            "software-engineering work described in it. Dispatches an "
            "orchestrator subagent that drives the plan's task DAG level by "
            "level (parallel within a level, sequential across levels), "
            "leaving the changes uncommitted in the working tree for "
            "simplify/review. Requires a plan path; "
            "delegation.max_spawn_depth >= 2 in config.yaml."
        ),
        emoji="⚙️",
    )
    ctx.register_tool(
        "simplify",
        _TOOLSET,
        _wrap_schema(_PLAN_PATH_SCHEMA),
        simplify_handler,
        is_async=False,
        description=(
            "USE WHEN: the plan's implementation exists and you want the "
            "code it produced simplified. Dispatches a review subagent to "
            "find simplification opportunities in the uncommitted diff; on "
            "a fix verdict you (the main agent) apply the suggestions and "
            "the reviewer re-runs automatically until it passes. Requires "
            "the plan path."
        ),
        emoji="🧹",
    )
    ctx.register_tool(
        "review",
        _TOOLSET,
        _wrap_schema(_PLAN_PATH_SCHEMA),
        review_handler,
        is_async=False,
        description=(
            "USE WHEN: the plan's implementation exists and you want the "
            "code it produced reviewed. Dispatches an adversarial review "
            "subagent to hunt for bugs, security holes, and contract "
            "violations in the uncommitted diff; on a fix verdict you (the "
            "main agent) fix the findings and the reviewer re-runs "
            "automatically until it passes. Requires the plan path."
        ),
        emoji="🛡️",
    )


# ── Dispatch helper (shared with hooks.py) ---------------------------------


def dispatch_pipeline_step(p: jstate.PipelineState, phase: str) -> dict[str, Any]:
    """Dispatch one pipeline phase subagent and return the parsed result.

    Renders the phase's prompt (Contract §4) with ``[[token]]`` substitution
    and the ``[jovaltus-pipeline:<tool>:<phase>]`` marker, builds the context
    text, and launches the child via ``ctx.subagent_lifecycle`` (Contract §5
    amendment — verified against Hermes v0.20.0 source: ``dispatch_tool``
    resolves parent_agent only from ``_cli_ref``, which is None outside an
    interactive CLI, so ``delegate_task`` via dispatch_tool fails on
    desktop/gateway/oneshot; ``subagent_lifecycle`` resolves the parent from
    a contextvar bound around every ``run_conversation`` turn and also fires
    the ``subagent_start``/``subagent_stop`` hooks the chain depends on).

    ``role="orchestrator"`` is used only for the execute phase.
    """
    if _CTX is None:
        raise RuntimeError("jovaltus tools not registered: call tools.register(ctx)")
    goal = _render_prompt(p, phase)
    context = _build_context(p)
    role = "orchestrator" if phase == "execute" else "leaf"
    try:
        # NOTE: SubagentLaunchRequest has no working_directory support in
        # v0.20.0 ("Hermes delegates use isolated task environments") — the
        # repo root travels inside the context text instead (Contract §5).
        request = _get_launch_request(goal, context, role)
        handle = _get_lifecycle(p.session_key).launch(request)
    except Exception as exc:  # noqa: BLE001 — surface any launch failure
        logger.exception("subagent_lifecycle launch failed for phase %s", phase)
        return {
            "status": "error",
            "message": f"subagent launch failed for phase {phase}: {exc}",
        }
    return {
        "status": "dispatched",
        "subagent_id": handle.subagent_id,
        "parent_session_id": handle.parent_session_id,
        "depth": handle.depth,
    }


def _get_launch_request(goal: str, context: str, role: str) -> Any:
    """Build a SubagentLaunchRequest.

    Kept behind its own function (like :func:`_get_lifecycle`) so tests can
    monkeypatch it without importing Hermes internals — the ``agent`` package
    only exists inside a Hermes runtime, not in CI unit-test environments.

    ``allowed_toolsets`` is deliberately left unset (None). Hermes's child
    construction inherits the parent agent's enabled toolsets when no
    explicit list is given (delegate_tool.py:1392-1395: ``toolsets=None`` →
    ``child_toolsets = _strip_blocked_tools(parent_enabled)``), so pipeline
    subagents share the main agent's toolset — they can read the repo with
    the same file/terminal/web tools the main agent has. Passing an explicit
    list here would REVERSE that and restrict subagents to only those tools.
    """
    from agent.subagent_lifecycle import SubagentLaunchRequest

    return SubagentLaunchRequest(goal=goal, context=context, role=role)


def _render_prompt(p: jstate.PipelineState, phase: str) -> str:
    """Load the phase prompt and substitute tokens + the pipeline marker."""
    prompt_name = _PHASE_PROMPTS.get(phase)
    if prompt_name is None:
        raise ValueError(f"no prompt for phase {phase!r}")
    text = load_prompt(prompt_name)
    text = text.replace("[[run_dir]]", p.run_dir)
    text = text.replace("[[repo_root]]", _repo_root())
    text = text.replace("[[user_requirements]]", p.user_requirements)
    text = text.replace("[[plan_path]]", p.plan_path or "")
    text = text.replace(_MARKER_PLACEHOLDER, f"[jovaltus-pipeline:{p.tool}:{phase}]")
    return text


def _build_context(p: jstate.PipelineState) -> str:
    """Context text for the child: repo root + run dir + phase info."""
    return (
        f"## Repo root\n{_repo_root()}\n"
        f"## Run directory\n{p.run_dir}\n"
        f"## Pipeline phase\n{p.phase}\n"
        f"## Plan path\n{p.plan_path or ''}\n"
    )


def _repo_root() -> str:
    """The main agent's working directory, inherited programmatically.

    Prefers ``agent.runtime_cwd.resolve_agent_cwd()`` — the canonical
    resolver the conversation loop, prompt builder, and context-file
    discovery use. It honors the per-session cwd contextvar the desktop
    app pins around every turn, then falls back to ``TERMINAL_CWD``, then
    the process cwd. Reading only ``TERMINAL_CWD`` rooted runs at the
    gateway launch dir in desktop sessions (often ``~``), so plans landed
    in ``~/.plan`` instead of ``<repo>/.plan``.
    """
    resolved = _resolve_agent_cwd()
    if resolved:
        return resolved
    env_cwd = os.environ.get("TERMINAL_CWD", "").strip()
    if env_cwd:
        try:
            resolved = os.path.abspath(os.path.expanduser(env_cwd))
            if os.path.isdir(resolved):
                return resolved
        except Exception:  # noqa: BLE001 — fall through to cwd
            pass
    return str(Path.cwd())


def _resolve_agent_cwd() -> str:
    """The Hermes agent's working directory, or ``""`` when unavailable.

    Imported lazily and guarded so unit tests / CI (which lack the Hermes
    runtime) fall through to the TERMINAL_CWD / cwd chain.
    """
    try:
        from agent.runtime_cwd import resolve_agent_cwd

        return str(resolve_agent_cwd())
    except Exception:  # noqa: BLE001 — no Hermes runtime (CI) or broken import
        return ""


# ── Tool handlers ----------------------------------------------------------


def plan_handler(args: dict[str, Any], **kwargs: Any) -> str:
    """Start the plan pipeline: prd → research → acceptance → tasks."""
    requirements = str(args.get("user_requirements", "")).strip()
    if not requirements:
        return _error_result("plan requires user_requirements")
    run_dir = _compute_run_dir(requirements)
    # The subagents write into run_dir (prompts say "write to [[run_dir]]/…"),
    # so the directory must exist before the first subagent starts.
    try:
        run_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        return _error_result(f"cannot create run directory {run_dir}: {exc}")
    routing = _capture_routing()
    p = jstate.start_pipeline(
        "plan",
        str(run_dir),
        user_requirements=requirements,
        **routing,
    )
    return _dispatch_first(p, "plan", "prd")


def execute_handler(args: dict[str, Any], **kwargs: Any) -> str:
    """Start the execute pipeline (orchestrator drives the task DAG)."""
    plan_path = _require_plan(args)
    if plan_path is None:
        return _error_result("execute requires a plan path")
    if not Path(plan_path).exists():
        return _error_result(f"plan path does not exist: {plan_path}")
    if _read_max_spawn_depth() < 2:
        return _error_result("execute requires delegation.max_spawn_depth >= 2")
    resolved = str(Path(plan_path).resolve())
    routing = _capture_routing()
    p = jstate.start_pipeline(
        "execute", str(Path(resolved).parent), plan_path=resolved, **routing
    )
    return _dispatch_first(p, "execute", "execute")


def simplify_handler(args: dict[str, Any], **kwargs: Any) -> str:
    """Start the simplify pipeline (review → fix → review → …)."""
    plan_path = _require_plan(args)
    if plan_path is None:
        return _error_result("simplify requires a plan path")
    if not Path(plan_path).exists():
        return _error_result(f"plan path does not exist: {plan_path}")
    resolved = str(Path(plan_path).resolve())
    routing = _capture_routing()
    p = jstate.start_pipeline(
        "simplify", str(Path(resolved).parent), plan_path=resolved, **routing
    )
    return _dispatch_first(p, "simplify", "simplify")


def review_handler(args: dict[str, Any], **kwargs: Any) -> str:
    """Start the review pipeline (review → fix → review → …)."""
    plan_path = _require_plan(args)
    if plan_path is None:
        return _error_result("review requires a plan path")
    if not Path(plan_path).exists():
        return _error_result(f"plan path does not exist: {plan_path}")
    resolved = str(Path(plan_path).resolve())
    routing = _capture_routing()
    p = jstate.start_pipeline(
        "review", str(Path(resolved).parent), plan_path=resolved, **routing
    )
    return _dispatch_first(p, "review", "review")


def _dispatch_first(p: jstate.PipelineState, tool: str, first_phase: str) -> str:
    """Dispatch the first phase and return the §1 started/error JSON.

    Routing metadata was captured by the handler before ``start_pipeline``
    and persisted on *p*, so every later notification targets the session
    that started this run — never a global snapshot that parallel sessions
    could have clobbered.
    """
    try:
        result = dispatch_pipeline_step(p, first_phase)
    except Exception as exc:  # noqa: BLE001 — surface any dispatch failure
        logger.exception("failed to dispatch %s phase %s", tool, first_phase)
        return _error_result(f"failed to dispatch {tool} phase {first_phase}: {exc}")
    if result.get("status") != "dispatched":
        message = str(
            result.get("message")
            or f"delegate_task did not dispatch (status={result.get('status')!r})"
        )
        return _error_result(message)
    return _started_result(p, tool, first_phase)


# ── JSON result helpers ----------------------------------------------------


def _started_result(p: jstate.PipelineState, tool: str, first_phase: str) -> str:
    return json.dumps(
        {
            "status": "started",
            "tool": tool,
            "phase": first_phase,
            "run_dir": p.run_dir,
            "message": (
                f"{tool} pipeline started in {p.run_dir}; "
                f"phase {first_phase} dispatched"
            ),
        }
    )


def _error_result(message: str) -> str:
    return json.dumps({"status": "error", "message": message})


# ── Input validation -------------------------------------------------------


def _require_plan(args: dict[str, Any]) -> str | None:
    """Return the non-empty ``plan`` arg, or None when missing."""
    plan = str(args.get("plan", "")).strip()
    return plan if plan else None


# ── Run dir computation (Contract §5) --------------------------------------


def _compute_run_dir(requirements: str) -> Path:
    """``<repo_root>/.plan/<YYYYmmdd>/<plan_name>/`` (suffixed -2/-3… on collision).

    The repo root is inherited programmatically from the main agent
    (``TERMINAL_CWD``, see :func:`_repo_root`); the day-level timestamp keeps
    runs grouped by date; ``plan_name`` is a kebab-case slug of the
    requirements so humans can tell runs apart. Same-day same-name runs get
    a ``-2``/``-3`` suffix.
    """
    base = Path(_repo_root()) / ".plan"
    timestamp = datetime.now().strftime("%Y%m%d")
    plan_name = _make_slug(requirements)
    run_dir = base / timestamp / plan_name
    suffix = 2
    while run_dir.exists():
        run_dir = base / timestamp / f"{plan_name}-{suffix}"
        suffix += 1
    return run_dir


def _make_slug(requirements: str) -> str:
    """Kebab-case of the first ~6 words; fallback ``"plan"``."""
    words = re.findall(r"\w+", requirements)[:6]
    if not words:
        return "plan"
    return "-".join(words).lower()


# ── delegation.max_spawn_depth (Contract §5 execute precondition) -----------


def _read_max_spawn_depth(config_path: Path | None = None) -> int:
    """Effective ``delegation.max_spawn_depth`` (default 1, Hermes' floor).

    Parses the Hermes config.yaml directly (no yaml dependency). Defaults to
    1 — matching Hermes' own ``MAX_DEPTH`` — when the file or key is missing
    or unparsable.
    """
    path = config_path or _config_path()
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return 1
    value = _scan_max_spawn_depth(text)
    if value is None:
        return 1
    return max(1, value)


def _config_path() -> Path:
    """Path to the active Hermes config.yaml (HERMES_HOME-aware)."""
    home = os.environ.get("HERMES_HOME")
    base = Path(home) if home else Path.home() / ".hermes"
    return base / "config.yaml"


def _scan_max_spawn_depth(text: str) -> int | None:
    """Scan YAML text for ``delegation.max_spawn_depth`` (no yaml dependency).

    Handles the YAML subset that matters: a top-level ``delegation:`` block
    whose indented keys include ``max_spawn_depth: <int>``.
    """
    in_delegation = False
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        stripped = line.strip()
        if not in_delegation:
            if indent == 0 and stripped.startswith("delegation:"):
                in_delegation = True
            continue
        if indent == 0:
            break  # left the delegation block
        if stripped.startswith("max_spawn_depth:"):
            raw_value = stripped.split(":", 1)[1].strip()
            try:
                return int(raw_value)
            except ValueError:
                return None
    return None
