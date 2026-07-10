---
name: jovaltus-agent
description: "Jovaltus Agent Mode — automated development pipeline with four phases: Plan → Implement → Verify & Fix → Simplify"
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [development, pipeline, code-quality, verification]
---

# Jovaltus Agent Mode Workflow

This skill defines the four-phase pipeline for automated development work.
The main agent (you) orchestrates by calling one tool per phase.
Each tool spawns a subagent with the right system prompt and permissions.

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

1. **Call `jovaltus_implement`** — Pass `project_dir` if not the cwd.
   This spawns an implement subagent that writes the code.
   The subagent auto-commits when done.

2. **Wait for the subagent result** — It arrives as a message.
   Review the summary of what was changed.

## Phase 2: Verify & Fix

1. **Call `jovaltus_verify`** — Pass the `task_id` from Phase 1.
   This computes the diff, spawns a verification subagent with write access
   that runs tests adversarially, finds bugs, fixes them, and commits.

2. **Wait for the subagent result** — Note what issues were found and fixed.

## Phase 3: Simplify

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
