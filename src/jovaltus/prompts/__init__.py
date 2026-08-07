"""Jovaltus subagent prompt library.

Each prompt is a self-contained Markdown goal document for one pipeline
subagent. Dispatchers load a prompt with :func:`load_prompt` and substitute
``[[token]]`` placeholders via ``str.replace`` — never ``.format()``,
because prompt bodies contain mermaid ``{}`` braces.
"""

from pathlib import Path

PROMPT_NAMES: tuple[str, ...] = (
    "prd",
    "research",
    "acceptance",
    "tasks",
    "execute",
    "simplify-review",
    "simplify-fix",
    "review",
    "review-fix",
)

_PROMPTS_DIR: Path = Path(__file__).resolve().parent


def load_prompt(name: str) -> str:
    """Return the Markdown prompt body for *name*.

    Args:
        name: One of :data:`PROMPT_NAMES` (e.g. ``"prd"``).

    Returns:
        The raw prompt text with ``[[token]]`` placeholders intact, ready
        for ``str.replace`` substitution by the dispatcher.

    Raises:
        FileNotFoundError: If *name* is not a known prompt name.
    """
    if name not in PROMPT_NAMES:
        raise FileNotFoundError(f"unknown prompt: {name!r}")
    return (_PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")
