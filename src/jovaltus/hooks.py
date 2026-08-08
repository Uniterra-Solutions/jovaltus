"""Jovaltus hook callbacks — drive the pipeline state machine.

Registered by ``hooks.init(ctx)`` in ``register()`` (Contract §2). Hook
callbacks receive ONLY their hook kwargs — never ctx (verified
``plugins.py:1936``) — so the ctx captured at init time lives module-level
and is used to dispatch the next pipeline phase from ``subagent_stop`` and
``post_llm_call``.

No-op rule (Contract §2): a hook only acts when the child belongs to the
plugin's own pipeline — a goal-marker match for ``subagent_start``, the
active child session id for ``subagent_stop``, a ``*_waiting`` phase with a
main-agent turn for ``post_llm_call``. Children of an
execute-orchestrator's grandchildren, other plugins' children, and
user-initiated subagents never touch pipeline state. Everything is guarded
so a misbehaving hook can never break the agent loop.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from jovaltus import state as jstate
from jovaltus.tools import CHAIN, dispatch_pipeline_step

logger = logging.getLogger(__name__)

# Captured at init() time; kept for Contract §2 parity with tools._CTX.
_CTX: Any = None

_MARKER_PREFIX = "[jovaltus-pipeline:"
_VALID_TOOLS: tuple[str, ...] = ("plan", "execute", "simplify", "review")
_REVIEWER_PHASES: tuple[str, ...] = ("simplify", "review")
# Phases where the reviewer found defects and the MAIN agent fixes them
# (no subagent iteration cap). The post_llm_call hook watches these.
_WAITING_PHASES: tuple[str, ...] = ("simplify_waiting", "review_waiting")
# Mirrors jstate._SUCCESS_STATUSES; kept local to avoid importing private names.
_SUCCESS_STATUSES: tuple[str, ...] = ("success", "completed")


def init(ctx: Any) -> None:
    """Capture ctx so hook callbacks can dispatch tools (Contract §2)."""
    global _CTX
    _CTX = ctx


def on_subagent_start(**kwargs: Any) -> None:
    """Associate a spawned child with the pipeline when its goal matches.

    A child whose goal contains ``[jovaltus-pipeline:<tool>:<phase>]``
    matching the current pipeline's expected phase is recorded as the active
    child. No marker match → no-op.

    Session gating: a pipeline pinned to a session (``p.session_key``) only
    accepts children spawned by that session's parent. Legacy pipelines
    without routing are ungated.
    """
    try:
        child_session_id = kwargs.get("child_session_id")
        if child_session_id is None:
            return
        marker = _parse_marker(str(kwargs.get("child_goal") or ""))
        if marker is None:
            return
        tool, phase = marker
        p = jstate.get_pipeline()
        if p is None or p.tool != tool or p.phase != phase:
            return
        parent_session_id = str(kwargs.get("parent_session_id") or "")
        if p.session_key and parent_session_id != p.session_key:
            return  # child of a DIFFERENT session's pipeline — never touch this one
        jstate.register_child(p, str(child_session_id))
    except Exception:  # noqa: BLE001 — a bad hook must not break the loop
        logger.exception("Jovaltus subagent_start hook failed")


def on_subagent_stop(**kwargs: Any) -> None:
    """Advance the pipeline when the active child completes.

    Acts only when :func:`jovaltus.state.complete_child` accepts the child
    session id (i.e. it was the pipeline's active child). A non-success
    status fails the pipeline; otherwise the chain advances per Contract §5.
    """
    try:
        child_session_id = kwargs.get("child_session_id")
        if child_session_id is None:
            return
        p = jstate.get_pipeline()
        if p is None:
            return
        parent_session_id = str(kwargs.get("parent_session_id") or "")
        if p.session_key and parent_session_id != p.session_key:
            return  # a different session's child — this pipeline is untouched
        status = str(kwargs.get("child_status") or "completed")
        summary = str(kwargs.get("child_summary") or "")
        if not jstate.complete_child(p, str(child_session_id), status, summary):
            return  # not our active child (e.g. orchestrator grandchildren)
        if status not in _SUCCESS_STATUSES:
            _finish_failed(p, error=summary)
            return
        _advance(p)
    except Exception:  # noqa: BLE001 — a bad hook must not break the loop
        logger.exception("Jovaltus subagent_stop hook failed")


def on_pre_llm_call(**kwargs: Any) -> dict[str, str] | None:
    """Inject a one-line pipeline status into the user message.

    Returns ``{"context": <status line>}`` when a pipeline exists (Contract
    §2), else None. Ephemeral, per-turn, injected into the user message only.
    """
    try:
        p = jstate.get_pipeline()
        if p is None:
            return None
        return {"context": jstate.status_text(p)}
    except Exception:  # noqa: BLE001 — a bad hook must not break the loop
        logger.exception("Jovaltus pre_llm_call hook failed")
        return None


def on_post_llm_call(**kwargs: Any) -> None:
    """Re-dispatch the reviewer after the main agent finishes fixing.

    Fires once per completed agent turn (turn_finalizer.py:573). Acts only
    when the pipeline is parked in a ``*_waiting`` phase (the reviewer
    verdict was "fix" and the main agent was woken to fix) AND the completed
    turn belongs to the main agent of the session that owns the pipeline —
    not a subagent and not another session's turn. All other states are
    no-ops, so the hook is effectively absent before the pipeline starts
    and after it ends.
    """
    try:
        p = jstate.get_pipeline()
        if p is None or p.status != "running":
            return
        if p.phase not in _WAITING_PHASES:
            return
        if str(kwargs.get("platform")) == "subagent":
            return  # subagent turns must not trigger the next review
        if p.session_key and str(kwargs.get("session_id") or "") != p.session_key:
            return  # another session's turn must not re-dispatch THIS pipeline
        next_phase = CHAIN[p.tool][p.phase]
        if next_phase == "done":
            _finish_done(p)
            return
        jstate.set_phase(p, next_phase)
        result = dispatch_pipeline_step(p, next_phase)
        if result.get("status") != "dispatched":
            # Same deterministic-failure contract as _advance: never leave the
            # pipeline "running" with no active child.
            message = str(
                result.get("message")
                or f"dispatch failed for phase {next_phase} (status={result.get('status')!r})"
            )
            logger.error("Jovaltus dispatch failed at %s: %s", next_phase, message)
            _finish_failed(p, error=message)
    except Exception:  # noqa: BLE001 — a bad hook must not break the loop
        logger.exception("Jovaltus post_llm_call hook failed")


# ── Chain advancement ------------------------------------------------------


def _advance(p: jstate.PipelineState) -> None:
    """Advance after a successful child, dispatching the next subagent."""
    if p.tool in ("simplify", "review") and p.phase in _REVIEWER_PHASES:
        verdict = _read_verdict(p)
        if verdict is None:
            _finish_failed(
                p,
                error=f"verdict.json missing or invalid in {p.run_dir}",
            )
            return
        if verdict == "pass":
            jstate.set_verdict(p, "pass")
            _finish_done(p)
            return
        # "fix": the main agent performs the fixes (no subagent iteration
        # cap, full conversation context). Park the pipeline in the waiting
        # phase and wake the main agent with the findings; on_post_llm_call
        # re-dispatches the reviewer once the fixing turn ends.
        p.loop_iteration += 1
        jstate.set_verdict(p, verdict)  # persists the incremented counter too
        waiting_phase = _waiting_phase(p.tool)
        jstate.set_phase(p, waiting_phase)
        _push_fix_request_event(p)
        return
    next_phase = CHAIN[p.tool][p.phase]
    if next_phase == "done":
        _finish_done(p)
        return
    jstate.set_phase(p, next_phase)
    result = dispatch_pipeline_step(p, next_phase)
    if result.get("status") != "dispatched":
        # A failed launch must not leave the pipeline stuck "running" with no
        # child — fail deterministically so the user can inspect and retry.
        message = str(
            result.get("message")
            or f"dispatch failed for phase {next_phase} (status={result.get('status')!r})"
        )
        logger.error("Jovaltus dispatch failed at %s: %s", next_phase, message)
        _finish_failed(p, error=message)


def _waiting_phase(tool: str) -> str:
    """The parking phase for a reviewer's \"fix\" verdict (no subagent runs)."""
    if tool == "simplify":
        return "simplify_waiting"
    if tool == "review":
        return "review_waiting"
    raise ValueError(f"no waiting phase for tool {tool!r}")


def _finish_done(p: jstate.PipelineState) -> None:
    """Terminal transition: phase ``"done"`` + status ``"done"``."""
    jstate.set_phase(p, "done")
    jstate.finish_pipeline(p, True)
    _push_completion_event(p, True)


def _finish_failed(p: jstate.PipelineState, error: str) -> None:
    """Terminal transition: status ``"failed"`` with *error*."""
    jstate.finish_pipeline(p, False, error=error)
    _push_completion_event(p, False)


def _build_completion_event(p: jstate.PipelineState, ok: bool) -> dict[str, Any]:
    """Completion event for the process_registry completion_queue.

    The queue is polled by the desktop/TUI, CLI, and gateway surfaces while
    the agent is idle; each drains a completion into a status update + a new
    agent turn, so the main agent learns the pipeline finished without
    waiting for the user's next message.

    Routing comes from the pipeline itself (captured at start and persisted
    on the run), so the event is addressed to the session that started it —
    even when other parallel sessions run pipelines in the same process.
    """
    evt: dict[str, Any] = {
        "type": "completion",
        "session_id": f"jovaltus-{p.tool}-{Path(p.run_dir).name}",
        "command": f"jovaltus {p.tool}",
        "exit_code": 0 if ok else 1,
        "completion_reason": "completed" if ok else "failed",
        "output": jstate.status_text(p),
    }
    if p.session_key:
        evt["session_key"] = p.session_key
    if p.origin_ui_session_id:
        evt["origin_ui_session_id"] = p.origin_ui_session_id
    return evt


def _push_completion_event(p: jstate.PipelineState, ok: bool) -> None:
    """Notify the host surface that the pipeline reached a terminal state.

    Best-effort: without the Hermes runtime (unit tests / CI) or when the
    queue is unavailable, the notification is skipped — the state machine
    and pre_llm_call status injection still carry the pipeline state.
    """
    try:
        from tools.process_registry import process_registry
    except Exception:  # noqa: BLE001 — no Hermes runtime (CI)
        return
    try:
        process_registry.completion_queue.put(_build_completion_event(p, ok))
    except Exception:  # noqa: BLE001 — a bad notification must not break the loop
        logger.debug("Jovaltus completion notification failed", exc_info=True)


def _build_fix_request_event(p: jstate.PipelineState) -> dict[str, Any]:
    """Fix-request wake-up event for the main agent.

    The host dedups completions on ``(type, session_id)``, so the session id
    carries ``loop_iteration``: each loop round gets a distinct identity and
    later fix requests are never swallowed. Routing mirrors
    :func:`_build_completion_event` — the pipeline's own session.
    """
    findings = _read_findings(p)
    session_id = f"jovaltus-{p.tool}-{Path(p.run_dir).name}-fix-{p.loop_iteration}"
    evt: dict[str, Any] = {
        "type": "completion",
        "session_id": session_id,
        "command": f"jovaltus {p.tool}",
        "exit_code": 0,
        "completion_reason": "needs_fix",
        "output": (
            f"[Jovaltus] {p.tool} round {p.loop_iteration}: reviewer "
            f"found defects. Fix them in the working tree; the reviewer "
            f"re-runs automatically after this turn.\n\n{findings}".strip()
        ),
    }
    if p.session_key:
        evt["session_key"] = p.session_key
    if p.origin_ui_session_id:
        evt["origin_ui_session_id"] = p.origin_ui_session_id
    return evt


def _push_fix_request_event(p: jstate.PipelineState) -> None:
    """Wake the main agent to fix the reviewer's findings.

    Fired when a reviewer verdicts "fix": the pipeline parks in a
    ``*_waiting`` phase and the main agent takes over the fixes. The event
    carries the findings from ``verdict.json`` and a per-iteration
    ``session_id`` so the host's completion dedup key ``(type, session_id)``
    never swallows later fix requests in the same loop.
    """
    try:
        from tools.process_registry import process_registry
    except Exception:  # noqa: BLE001 — no Hermes runtime (CI)
        return
    try:
        process_registry.completion_queue.put(_build_fix_request_event(p))
    except Exception:  # noqa: BLE001 — a bad notification must not break the loop
        logger.debug("Jovaltus fix-request notification failed", exc_info=True)


def _read_findings(p: jstate.PipelineState) -> str:
    """The reviewer's ``findings`` text from verdict.json, or ``\"\"``."""
    verdict_file = Path(p.run_dir) / "verdict.json"
    try:
        data = json.loads(verdict_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    if not isinstance(data, dict):
        return ""
    findings = data.get("findings")
    if not isinstance(findings, str):
        return ""
    return findings


def _read_verdict(p: jstate.PipelineState) -> str | None:
    """Read ``<run_dir>/verdict.json`` → ``"pass"`` | ``"fix"``.

    Returns None when the file is missing, unparsable, or holds an invalid
    verdict — the caller fails the pipeline deterministically.
    """
    verdict_file = Path(p.run_dir) / "verdict.json"
    try:
        data = json.loads(verdict_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    verdict = data.get("verdict")
    if verdict not in ("pass", "fix"):
        return None
    return str(verdict)


# ── Marker parsing ---------------------------------------------------------


def _parse_marker(goal: str) -> tuple[str, str] | None:
    """Extract ``(tool, phase)`` from a goal's pipeline marker, else None."""
    start = goal.find(_MARKER_PREFIX)
    if start < 0:
        return None
    end = goal.find("]", start)
    if end < 0:
        return None
    inner = goal[start + len(_MARKER_PREFIX) : end]
    tool, sep, phase = inner.partition(":")
    if not sep or tool not in _VALID_TOOLS or not phase:
        return None
    return tool, phase
