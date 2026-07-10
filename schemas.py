"""Tool JSON schemas — what the LLM sees.

Each schema describes the tool name, when the model should call it,
and what arguments it expects.

All three tools now spawn subagents automatically via delegate_task.
The main agent only needs to call the tool — no manual delegate_task needed.
"""

IMPLEMENT_SCHEMA = {
    "name": "jovaltus_implement",
    "description": (
        "Start the IMPLEMENT phase. Spawns an implement subagent that "
        "writes code to satisfy the user's requirements. "
        "The subagent auto-commits when done. "
        "\n\n"
        "Call this AFTER the user has confirmed the requirements (Phase 0). "
        "The subagent has terminal and file access. "
        "It will report BLOCKED if genuinely stuck."
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
        "Call this AFTER the implement subagent has finished. "
        "Pass the task_id from jovaltus_implement's response."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "description": "The task_id returned by jovaltus_implement.",
            },
            "project_dir": {
                "type": "string",
                "description": (
                    "Absolute path to the git repository. "
                    "Defaults to the current working directory."
                ),
            },
        },
        "required": ["task_id"],
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
        "Call this AFTER the verification subagent has finished. "
        "Pass the task_id from jovaltus_implement's response."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "description": "The task_id returned by jovaltus_implement.",
            },
            "project_dir": {
                "type": "string",
                "description": (
                    "Absolute path to the git repository. "
                    "Defaults to the current working directory."
                ),
            },
        },
        "required": ["task_id"],
    },
}
