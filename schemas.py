"""Tool JSON schemas — what the LLM sees.

Each schema describes the tool name, when the model should call it,
and what arguments it expects.

All three tools validate the pipeline stage before spawning subagents:
- jovaltus_implement: requires no active task (or stage idle/done)
- jovaltus_verify: requires stage "implement" (task_id mode) or bypasses
  stage validation via before/after commit hashes (commit mode)
- jovaltus_simplify: requires stage "verify" (task_id mode) or bypasses
  stage validation via before/after commit hashes (commit mode)

Hooks inject stage guidance before each LLM turn so the agent
always knows where it is in the pipeline.
"""

IMPLEMENT_SCHEMA = {
    "name": "jovaltus_implement",
    "description": (
        "Start the IMPLEMENT phase. Spawns an implement subagent that "
        "writes code to satisfy the user's requirements. "
        "The subagent auto-commits when done. "
        "\n\n"
        "Stage validation: requires no active pipeline task "
        "(or current stage is idle/done). "
        "Call this AFTER the user has confirmed the requirements (Phase 0). "
        "The subagent has terminal and file access. "
        "It will report BLOCKED if genuinely stuck."
        "\n\n"
        "The returned start_hash can be passed to jovaltus_verify or "
        "jovaltus_simplify as the 'before' parameter for commit-based mode."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "project_dir": {
                "type": "string",
                "description": (
                    "Absolute path to the git repository. "
                    "Defaults to the current working directory."
                ),
            },
        },
    },
}

VERIFY_SCHEMA = {
    "name": "jovaltus_verify",
    "description": (
        "Start the VERIFY & FIX phase. Spawns a verification subagent "
        "that runs the code adversarially — tries to break it, finds bugs, "
        "fixes them, and repeats until all checks pass. "
        "The subagent has write access and auto-commits when done. "
        "\n\n"
        "Two invocation modes:\n"
        "1. task_id mode: Pass a task_id from jovaltus_implement. "
        "Enforces pipeline stage ordering (requires stage 'implement').\n"
        "2. commit mode: Pass 'before' (and optionally 'after') commit hashes. "
        "Bypasses stage validation for greater flexibility. "
        "'after' defaults to HEAD when only 'before' is given."
        "\n\n"
        "task_id and before are mutually exclusive — provide one or the other."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "description": "The task_id returned by jovaltus_implement (task_id mode).",
            },
            "before": {
                "type": "string",
                "description": (
                    "Start commit hash for the diff range (commit mode). "
                    "When combined with 'after', verifies before..after. "
                    "When used alone, verifies before..HEAD. "
                    "Cannot be used with task_id."
                ),
            },
            "after": {
                "type": "string",
                "description": (
                    "End commit hash for the diff range (commit mode). "
                    "Optional — defaults to HEAD. Only meaningful with 'before'."
                ),
            },
            "project_dir": {
                "type": "string",
                "description": (
                    "Absolute path to the git repository. "
                    "Defaults to the current working directory."
                ),
            },
        },
    },
}

SIMPLIFY_SCHEMA = {
    "name": "jovaltus_simplify",
    "description": (
        "Start the SIMPLIFY phase. Spawns a simplifier subagent that "
        "applies structural improvements to the changes without altering "
        "behaviour: extract duplicates > delete dead code > flatten nesting "
        "> improve naming. "
        "Every deletion requires grep evidence. Auto-commits when done. "
        "\n\n"
        "Two invocation modes:\n"
        "1. task_id mode: Pass a task_id from jovaltus_implement. "
        "Enforces pipeline stage ordering (requires stage 'verify').\n"
        "2. commit mode: Pass 'before' (and optionally 'after') commit hashes. "
        "Bypasses stage validation for greater flexibility. "
        "'after' defaults to HEAD when only 'before' is given."
        "\n\n"
        "task_id and before are mutually exclusive — provide one or the other."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "description": "The task_id returned by jovaltus_implement (task_id mode).",
            },
            "before": {
                "type": "string",
                "description": (
                    "Start commit hash for the diff range (commit mode). "
                    "When combined with 'after', simplifies before..after. "
                    "When used alone, simplifies before..HEAD. "
                    "Cannot be used with task_id."
                ),
            },
            "after": {
                "type": "string",
                "description": (
                    "End commit hash for the diff range (commit mode). "
                    "Optional — defaults to HEAD. Only meaningful with 'before'."
                ),
            },
            "project_dir": {
                "type": "string",
                "description": (
                    "Absolute path to the git repository. "
                    "Defaults to the current working directory."
                ),
            },
        },
    },
}
