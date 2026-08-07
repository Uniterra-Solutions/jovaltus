"""Jovaltus deterministic pipeline state machine.

Persistence lives in the fabricium-managed ``~/.hermes/jovaltus_state.json``
file (via ``fabricium.state.load_state`` / ``save_state``). Pipeline state is
stored under the top-level ``"pipeline"`` key; the ``"profiles"`` key is
fabricium-owned (plugin installation state) and is never touched here.

The state machine is deliberately dumb: it records transitions and persists
them. Deciding *which* transition to take lives in ``hooks.py`` (T2); this
module never imports Hermes APIs — stdlib + ``fabricium.state`` only.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

import fabricium.state as fstate

_PLUGIN_NAME = "jovaltus"
_PIPELINE_KEY = "pipeline"

PHASES: tuple[str, ...] = (
    "prd",
    "research",
    "acceptance",
    "tasks",
    "execute",
    "simplify",
    "simplify_fix",
    "review",
    "review_fix",
)

STATUSES: tuple[str, ...] = ("idle", "running", "done", "failed")

# child_status values the subagent_stop hook forwards that count as success.
# Hermes v0.20.0 emits "completed" (delegate_tool.py:2329); "success" is kept
# for the historical contract and tests.
_SUCCESS_STATUSES: tuple[str, ...] = ("success", "completed")

# First phase of each tool's chain (Contract §3).
_FIRST_PHASE: dict[str, str] = {
    "plan": "prd",
    "execute": "execute",
    "simplify": "simplify",
    "review": "review",
}

# set_phase() additionally accepts the terminal "done" phase used by the
# phase chains (e.g. plan: prd → … → tasks → done).
_VALID_PHASES: tuple[str, ...] = PHASES + ("done",)

_VALID_VERDICTS: tuple[str, ...] = ("pass", "fix")


@dataclass
class PipelineState:
    """Snapshot of one pipeline run (see Contract §3).

    ``to_dict()`` / ``from_dict()`` round-trip losslessly, which is what
    makes cross-session resume possible: the whole dataclass is serialized
    to JSON under the ``"pipeline"`` key and re-read from disk on every
    :func:`get_pipeline` call.
    """

    run_dir: str  # abs path to <repo_root>/.plan/<YYYYmmdd>/<plan_name>/
    tool: str  # "plan" | "execute" | "simplify" | "review"
    phase: str  # one of PHASES (or "done")
    status: str  # one of STATUSES
    user_requirements: str
    plan_path: str | None  # required for execute/simplify/review
    active_child_session_id: str | None
    loop_iteration: int  # simplify/review loop counter (no cap)
    verdict: str | None  # "pass" | "fix" | None
    updated_at: str  # ISO timestamp
    error: str | None

    def to_dict(self) -> dict[str, Any]:
        """Serialize losslessly to a JSON-encodable dict."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PipelineState:
        """Deserialize a dict produced by :meth:`to_dict`."""
        return cls(
            run_dir=str(data["run_dir"]),
            tool=str(data["tool"]),
            phase=str(data["phase"]),
            status=str(data["status"]),
            user_requirements=str(data["user_requirements"]),
            plan_path=_optional_str(data.get("plan_path")),
            active_child_session_id=_optional_str(data.get("active_child_session_id")),
            loop_iteration=int(data["loop_iteration"]),
            verdict=_optional_str(data.get("verdict")),
            updated_at=str(data["updated_at"]),
            error=_optional_str(data.get("error")),
        )


def _optional_str(value: Any) -> str | None:
    """Coerce *value* to str, preserving None (nullable fields)."""
    return None if value is None else str(value)


def _now() -> str:
    """ISO-8601 UTC timestamp for ``updated_at``."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load() -> dict[str, Any]:
    """Load the full plugin state dict, preserving the "profiles" key."""
    raw = fstate.load_state(_PLUGIN_NAME)
    # fabricium returns Any under --no-site-packages; coerce defensively so
    # mypy strict stays green in the pre-commit environment.
    if not isinstance(raw, dict):
        return {}
    return raw


def _persist(p: PipelineState) -> None:
    """Merge *p* under the "pipeline" key and save, keeping other keys."""
    state = _load()
    state[_PIPELINE_KEY] = p.to_dict()
    fstate.save_state(_PLUGIN_NAME, state)


def get_pipeline() -> PipelineState | None:
    """Return the persisted pipeline, or None when idle.

    Always reads from disk, so an interrupted pipeline resumes across
    sessions and process boundaries.
    """
    raw = _load().get(_PIPELINE_KEY)
    if not isinstance(raw, dict):
        return None
    return PipelineState.from_dict(raw)


def start_pipeline(
    tool: str,
    run_dir: str,
    user_requirements: str = "",
    plan_path: str | None = None,
) -> PipelineState:
    """Start (or overwrite) a pipeline run for *tool*.

    The new pipeline begins in the tool's first phase with status
    "running".
    """
    if tool not in _FIRST_PHASE:
        raise ValueError(f"unknown pipeline tool: {tool!r}")
    p = PipelineState(
        run_dir=run_dir,
        tool=tool,
        phase=_FIRST_PHASE[tool],
        status="running",
        user_requirements=user_requirements,
        plan_path=plan_path,
        active_child_session_id=None,
        loop_iteration=0,
        verdict=None,
        updated_at=_now(),
        error=None,
    )
    _persist(p)
    return p


def set_phase(p: PipelineState, phase: str) -> None:
    """Record a phase transition and persist."""
    if phase not in _VALID_PHASES:
        raise ValueError(f"unknown phase: {phase!r}")
    p.phase = phase
    p.updated_at = _now()
    _persist(p)


def register_child(p: PipelineState, child_session_id: str) -> None:
    """Associate the pipeline with a spawned subagent and persist."""
    p.active_child_session_id = child_session_id
    p.updated_at = _now()
    _persist(p)


def complete_child(
    p: PipelineState, child_session_id: str, status: str, summary: str
) -> bool:
    """Mark a subagent as complete.

    Returns True only when *child_session_id* matches the active child
    (which is then cleared). A non-success *status* marks the pipeline
    failed with *summary* as the recorded error. Persists when matched.

    Success statuses: ``"success"`` (historical) and ``"completed"``
    (what Hermes v0.20.0's ``_run_single_child`` actually emits,
    delegate_tool.py:2329 — the ``subagent_stop`` hook forwards this
    verbatim as ``child_status``).
    """
    if p.active_child_session_id != child_session_id:
        return False
    p.active_child_session_id = None
    if status not in _SUCCESS_STATUSES:
        p.status = "failed"
        p.error = summary
    p.updated_at = _now()
    _persist(p)
    return True


def set_verdict(p: PipelineState, verdict: str) -> None:
    """Record a simplify/review verdict ("pass" or "fix") and persist."""
    if verdict not in _VALID_VERDICTS:
        raise ValueError(f"invalid verdict: {verdict!r}")
    p.verdict = verdict
    p.updated_at = _now()
    _persist(p)


def finish_pipeline(p: PipelineState, ok: bool, error: str | None = None) -> None:
    """Terminate the pipeline: status "done" when *ok*, else "failed"."""
    p.status = "done" if ok else "failed"
    if ok:
        p.error = None
    elif error is not None:
        p.error = error
    p.updated_at = _now()
    _persist(p)


def status_text(p: PipelineState) -> str:
    """Single-line pipeline status, e.g. for pre_llm_call context injection.

    A completed plan pipeline appends a pointer to the generated task
    manifest.
    """
    base = (
        f"[Jovaltus pipeline] tool={p.tool} phase={p.phase} "
        f"status={p.status} run_dir={p.run_dir}"
    )
    if p.tool == "plan" and p.phase == "done" and p.status == "done":
        return f"{base} — plan complete: {p.run_dir}/tasks.md"
    return base


def reset_pipeline() -> None:
    """Remove the "pipeline" key (back to idle), keeping other keys."""
    state = _load()
    state.pop(_PIPELINE_KEY, None)
    fstate.save_state(_PLUGIN_NAME, state)
