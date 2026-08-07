"""Auto-configure Hermes profile config for Jovaltus requirements.

The execute pipeline needs ``delegation.max_spawn_depth >= 2`` (the
execute-orchestrator subagent spawns its own worker subagents). ``hermes
jovaltus setup`` and ``hermes jovaltus update`` call :func:`ensure_max_spawn_depth`
so the requirement is satisfied out of the box.

The config edit is deliberately text-based (no ``yaml`` dependency — the
plugin parses Hermes config.yaml with a scanner in ``tools.py``; this module
mirrors that approach for the write direction). Only the top-level
``delegation:`` block is touched; every other key, comment, and value is
preserved byte-for-byte.
"""

from __future__ import annotations

from pathlib import Path

_MIN_DEFAULT = 2


def ensure_max_spawn_depth(profile_dir: Path, minimum: int = _MIN_DEFAULT) -> bool:
    """Ensure ``<profile_dir>/config.yaml`` sets ``delegation.max_spawn_depth``.

    Bumps the value to *minimum* when it is missing or lower; leaves it
    untouched when already sufficient. Returns True when the config is
    (or became) sufficient, False when the file cannot be read or written.
    """
    cfg = profile_dir / "config.yaml"
    try:
        text = cfg.read_text(encoding="utf-8")
    except OSError:
        return False
    updated = _ensure_max_spawn_depth_text(text, minimum)
    if updated == text:
        return True
    try:
        cfg.write_text(updated, encoding="utf-8")
    except OSError:
        return False
    return True


def _ensure_max_spawn_depth_text(text: str, minimum: int) -> str:
    """Return *text* with ``delegation.max_spawn_depth`` ensured to *minimum*.

    Rules (matching ``tools._scan_max_spawn_depth``'s view of the YAML):
    - only the first top-level ``delegation:`` block is considered;
    - an existing ``max_spawn_depth: N`` key at indent 2 is bumped only when
      ``N < minimum`` (already-sufficient values are left as-is);
    - a ``delegation:`` block without the key gets it inserted right after
      the header line;
    - an inline header (``delegation: {}`` / a scalar) is expanded to a block;
    - no ``delegation:`` block → one is appended at the end.
    """
    lines = text.splitlines()
    out: list[str] = []
    found_header = False
    found_key = False
    header_out_index = -1
    i = 0
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()
        indent = len(raw) - len(raw.lstrip(" "))
        is_top_key = bool(stripped) and not stripped.startswith("#") and indent == 0
        if is_top_key and stripped.startswith("delegation:") and not found_header:
            found_header = True
            rest = stripped[len("delegation:") :].strip()
            if rest and not rest.startswith("#"):
                # Inline mapping (delegation: {}) or scalar — expand to a block.
                out.append("delegation:")
                out.append(f"  max_spawn_depth: {minimum}")
                found_key = True
                header_out_index = -1
                i += 1
                continue
            out.append(raw)
            header_out_index = len(out) - 1
            i += 1
            while i < len(lines):
                inner = lines[i]
                inner_stripped = inner.strip()
                inner_indent = len(inner) - len(inner.lstrip(" "))
                if (
                    inner_stripped
                    and not inner_stripped.startswith("#")
                    and inner_indent == 0
                ):
                    break  # left the delegation block
                if (
                    inner_indent == 2
                    and inner_stripped.startswith("max_spawn_depth:")
                    and not found_key
                ):
                    value = inner_stripped.split(":", 1)[1].split("#", 1)[0].strip()
                    try:
                        current = int(value)
                    except ValueError:
                        current = 0
                    out.append(
                        f"  max_spawn_depth: {minimum}" if current < minimum else inner
                    )
                    found_key = True
                    i += 1
                    continue
                out.append(inner)
                i += 1
            continue
        out.append(raw)
        i += 1

    if not found_header:
        out.append("")
        out.append("delegation:")
        out.append(f"  max_spawn_depth: {minimum}")
    elif not found_key and header_out_index >= 0:
        out.insert(header_out_index + 1, f"  max_spawn_depth: {minimum}")
    return "\n".join(out).rstrip() + "\n"
