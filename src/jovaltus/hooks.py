"""Jovaltus hook callbacks — drive the pipeline state machine.

Registered by ``hooks.init(ctx)`` in ``register()`` (Contract §2). Hook
callbacks receive ONLY their hook kwargs — never ctx (verified
``plugins.py:1936``) — so the ctx captured at init time lives module-level
and is used to dispatch the next pipeline phase from ``subagent_stop``.

No-op rule (Contract §2): a hook only acts when the child belongs to the
plugin's own pipeline — a goal-marker match for ``subagent_start``, the
active child session id for ``subagent_stop``. Children of an
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
        status = str(kwargs.get("child_status") or "completed")
        summary = str(kwargs.get("child_summary") or "")
        if not jstate.complete_child(p, str(child_session_id), status, summary):
            return  # not our active child (e.g. orchestrator grandchildren)
        if status not in _SUCCESS_STATUSES:
            jstate.finish_pipeline(p, False, error=summary)
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


# ── Chain advancement ------------------------------------------------------


def _advance(p: jstate.PipelineState) -> None:
    """Advance after a successful child, dispatching the next subagent."""
    if p.tool in ("simplify", "review") and p.phase in _REVIEWER_PHASES:
        verdict = _read_verdict(p)
        if verdict is None:
            jstate.finish_pipeline(
                p,
                False,
                error=f"verdict.json missing or invalid in {p.run_dir}",
            )
            return
        if verdict == "pass":
            jstate.set_verdict(p, "pass")
            _finish_done(p)
            return
        p.loop_iteration += 1
        jstate.set_verdict(p, verdict)  # persists the incremented counter too
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
        jstate.finish_pipeline(p, False, error=message)


def _finish_done(p: jstate.PipelineState) -> None:
    """Terminal transition: phase ``"done"`` + status ``"done"``."""
    jstate.set_phase(p, "done")
    jstate.finish_pipeline(p, True)


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
