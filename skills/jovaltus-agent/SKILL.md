---
name: jovaltus-agent
description: "Jovaltus Agent Mode — automated development pipeline with four phases: Plan → Implement → Verify & Fix → Simplify"
author: LaiTszKin
version: 0.2.0
metadata:
  jovaltus:
    tags: [development, pipeline, code-quality, verification]
  cli_commands:
    setup: "Create jovaltus-agent profile and apply SOUL.md (coding agent identity)"
    update: "Check for and apply plugin updates from remote repository"
---

# Jovaltus Agent Mode Workflow

This skill defines the four-phase pipeline for automated development work.
The main agent (you) orchestrates by calling one tool per phase.
Each tool spawns a subagent with the right system prompt and permissions.

**✨ New: Stage-Guided Pipeline**
Jovaltus now includes hooks that inject stage guidance before each LLM turn:
- **`pre_llm_call` hook** — before each turn, injects a banner showing
  current stage, pipeline progress, and what to do next
- **`post_tool_call` hook** — tracks stage transitions and active task
- **Stage validation** — each tool checks you're in the correct stage
  before spawning a subagent

This follows the "soft enforcement / adaptive nudge" pattern:
the agent always knows its stage, but is never forced.

## Phase 0: Planning (You — the main agent)

**Do not start implementing until the user confirms the plan.**

1. **Clarify requirements** — Use `clarify` to ask 1-3 questions per round.
   Cover: Scope, Business flow, Constraints, Business value.

2. **Build a checklist** — Structured business requirements the user can
   say yes/no to.

3. **Research** — Use `web_search` if you need up-to-date information
   (API docs, package versions, known issues).

4. **Confirm** — Present the checklist to the user with `clarify`.
   Wait for explicit confirmation before Phase 1.

## Phase 1: Implement

**Stage constraint:** No active task required (stage must be idle/done).

### Path A — Subagent (default): Call `jovaltus_implement`

Pass `project_dir` if not the cwd. Spawns an implement subagent that writes
the code and auto-commits. Wait for the result and review the summary.

**Use Path A when:**
- The change spans multiple files with complex interdependencies
- You lack deep context — a subagent needs to explore the codebase
- The task involves significant reasoning (algorithm design, data model
  changes, refactoring with side effects)
- You want an independent checkpoint commit from a focused worker

### Path B — Direct: implement yourself

Write the code directly without spawning a subagent.

**Use Path B when all of these hold:**
- The change is **well-scoped and self-contained** (single file, clear
  before/after shape, no hidden ripple effects)
- You already have full context — you've read all relevant files and
  understand the architecture well enough that a subagent would need to
  re-discover everything you already hold
- The task is **mechanical** rather than reasoning-heavy (add a CLI command
  that follows an existing pattern, rename, format migration)

When implementing directly, still follow the Verification Checklist below
(run tests, lint, type-check, review for edge cases) before claiming
completion. No commit is required until Phase 2 is satisfied.

## Phase 2: Verify & Fix

**Stage constraint:** Requires stage "implement". Call `jovaltus_verify`
with the `task_id` from Phase 1.

1. **Call `jovaltus_verify`** — Pass the `task_id` from Phase 1.
   This computes the diff, spawns a verification subagent with write access
   that runs tests adversarially, finds bugs, fixes them, and commits.

2. **Wait for the subagent result** — Note what issues were found and fixed.

## Phase 3: Simplify

**Stage constraint:** Requires stage "verify". Call `jovaltus_simplify`
with the `task_id` from Phase 1.

1. **Call `jovaltus_simplify`** — Pass the `task_id` from Phase 1.
   This computes the clean diff, spawns a simplifier subagent that applies
   structural improvements (extract duplicates > delete dead code > flatten
   nesting > improve naming). Behaviour is strictly preserved.

2. **Wait for the subagent result** — Note what was simplified.

## Afterwards

Present the final result to the user:
- What was implemented
- What issues were found and fixed during verification
- What was simplified
- Any notable decisions or trade-offs

Then ask if they'd like to start a new task or adjust anything.
