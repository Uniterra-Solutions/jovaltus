---
name: jovaltus
description: >
  Core Jovaltus workflow. Smart entry-point routing: analyzes user prompt
  maturity to skip completed phases (vague idea → discuss, detailed
  requirements → write PRD → design, requirements + technical plan →
  write PRD + design.md → to-spec). Later phases run sequentially.
  LOAD when:
  - User describes a new project/feature to build
  - User says "I want to build..." / "幫我整..." / "寫一個..."
  - User asks "how does Jovaltus work?" or provides a PRD/spec
  Do NOT use for:
  - Existing codebase bugs, debugging, refactoring (→ agentic-debugging)
  - Code review or QA on already-built systems
  - Single-file scripts or trivial one-shot changes
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [pipeline, workflow, orchestration, entry-point, core]
---

# Jovaltus — Core Workflow

## Goal

Route the user to the correct Jovaltus pipeline entry point based on how
much they've already prepared. Skip phases whose outputs are already present
in their prompt — don't redo work they've already done.

The Jovaltus pipeline: `discuss → design → to-spec → to-tasks → to-environment → execute → simplify → review → qa`.
Each phase reads the previous phase's document, produces its own artifact,
and hands off. No conversation history is needed between phases — documents
are the contract.

## Acceptance Criteria

- Entry point determined in one pass — no back-and-forth
- User confirmed the entry point before proceeding
- PRD and design.md written non-interactively when inputs are already complete
- User reviews each document before the pipeline continues
- Uncertain classification → default to `discuss` (conservative fallback)

## Core Principles

**Respect preparation. Confirm before skipping. When in doubt, start earlier.**

If the user already did the thinking, don't redo it. Interactive questioning
is for gaps — not a ritual. Always tell the user what you detected and which
phase you're starting from; let them correct. A conservative classification
(one extra confirmation round) costs less than an aggressive one (rewriting
a design doc the user already had in mind).

## Workflow

### Phase 1: Scan the Prompt

Don't ask questions yet. Read the prompt and count how many domains the user
covered with **concrete, specific detail** — not passing mentions.

**Requirement signals** (8 domains from `discuss`):
Who & Why · Core Features · Data & Entities · User Journeys · Integrations ·
Non-functional (load, security, i18n) · Constraints (tech, deadline, platform) ·
Edge Cases (failure modes, empty states, concurrency)

**Technical-plan signals** (10 domains from `design`):
Architecture (system shape, sync/async) · Tech Stack (with rationale) ·
Data Model (fields + types + constraints) · API Design (style, endpoints, auth) ·
Components (module boundaries, interfaces) · Data Flow (write/read paths, events) ·
Auth & Security (mechanism, data protection) · Error Handling (retry, circuit breakers) ·
Infrastructure (hosting, CI/CD, monitoring) · Non-functional (caching, load numbers)

### Phase 2: Classify

```
req ≥ 5, tech ≥ 5  →  LEVEL 3: write PRD + design.md → review → to-spec
req ≥ 5, tech ≤ 4  →  LEVEL 2: write PRD → review → design
req ≤ 4            →  LEVEL 1: load discuss
```

Also check `.plan/<DD-MM-YYYY>/<name>/` — if `prd.md` or `design.md` already
exists, skip writing it (handles resume-after-interruption).

### Phase 3: Confirm

Tell the user what you found (match conversation language):

> 你覆蓋咗需求嘅 X/8 領域，技術方案 Y/10 領域。我建議由 **Z** 開始。OK？

Wait for confirmation. If they disagree, adjust.

### Phase 4: Execute

**Level 1 — Vague idea:** Load `discuss` skill, follow its workflow.

**Level 2 — Write PRD directly:**
1. Map every concrete statement in the prompt to the 8 requirement domains.
2. For gaps: ask ONE targeted question per gap. Don't redo full discuss.
3. Write `.plan/<DD-MM-YYYY>/<name>/prd.md` using `discuss`'s template.
4. Present → user approves → "Ready for technical design?" → load `design`.

**Level 3 — Write PRD + design.md directly:**
1. Write PRD first (same as Level 2). Don't write design until PRD is approved.
2. Map every technical decision to the 10 design domains. Fill gaps with
   reasonable defaults — flag as "Agent proposed — please review."
3. Write `.plan/<DD-MM-YYYY>/<name>/design.md` using `design`'s template.
4. Present → user approves → "Ready for implementation specs?" → load `to-spec`.

### Phase 5: Continue

After the entry point, the remaining phases run sequentially. After each
phase, offer the natural next step. No further routing needed.

## Fast-Path Rules

Override normal classification when the signal is unambiguous:

- **User provides a PRD file/link** → verify, ask: design or to-spec next?
- **User provides PRD + design doc** → skip to to-spec
- **One-sentence prompt** ("I want a todo app") → don't count domains, load discuss
- **User says "just build it" with file paths + stack + acceptance criteria**
  → check if it maps to spec format; if yes, offer to-tasks

## Gotchas

- **Domain count is a heuristic, not a contract.** 5 superficial domains <
  3 deeply detailed ones. Quality > quantity. Err on the side of asking.
- **"I already know what I want" but prompt is vague.** One gentle probe:
  "Who will use this and what are the core features?" Then classify.
- **Templates live in target skills, not here.** Load via
  `skill_view(name='discuss', file_path='assets/prd-template.md')`.
- **This skill routes — it doesn't replace discuss or design.** After routing,
  load the target skill and follow its acceptance criteria.
- **Don't jump ahead without user approval.** Every document must be reviewed
  before the pipeline continues. The user is the gate.
- **Use `<DD-MM-YYYY>` for dates, lowercase-hyphens for project name slugs.**
