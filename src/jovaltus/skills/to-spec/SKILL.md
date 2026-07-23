---
name: to-spec
description: >
  Translates PRD and technical design into agent-executable implementation
  specs. Each spec is self-contained: concrete stack, exact file paths,
  Given/When/Then acceptance criteria, three-tier boundaries, verification
  command. Agents can implement without follow-up questions.
  LOAD when:
  - PRD and design doc exist; user is ready to spec out implementation
  - User says "write the spec" or "break into implementation tasks"
  - User asks for executable task breakdown from PRD + design
  Do NOT use for:
  - Requirements gathering (use discuss)
  - Technical design decisions (use design)
  - Writing code directly — this produces specs, not code
  - Creating task work packages (use to-tasks)
author: LaiTszKin
version: 0.1.1
metadata:
  jovaltus:
    tags: [implementation, spec, tasks, agent-executable, planning]
---

# Implementation Spec

## Goal

Translate PRD + design into agent-executable specs. Each spec is a
self-contained unit of work: a new agent reading only that spec can
implement it without ambiguity.

## Acceptance Criteria

- Every spec is self-contained, implementable from the spec + design doc alone
- Minimum 3 Given/When/Then criteria: happy path, error state, edge case
- Exact files named: CREATE, READ (context), EDIT, NEVER TOUCH
- Concrete verification command producing clear pass/fail
- Three-tier boundaries on every spec (Always/Ask/Never)
- All P0 + P1 PRD features covered by at least one spec

## Core Principles

**The spec's job is to remove decisions.** Every blank = a decision the agent
will make — and get wrong. "Handle errors" becomes 200 with empty body.
"Use a database" becomes SQLite (most common in training data). Leave
zero blanks.

**Concrete over abstract.** "Store user's email" → "Table `users`, column
`email` VARCHAR(255) UNIQUE NOT NULL". "Return an error" → "HTTP 409,
`{"error": "EMAIL_EXISTS"}`".

**Banned words in specs.** "Handle", "support", "manage", "process" — if
you can't specify the exact behavior, the requirement isn't ready.

**One spec = one agent session.** Completions in 15-30 min. If longer,
split further.

**Logically independent, not just file-independent.** A spec must be
verifiable in complete isolation. Its acceptance criteria must pass without
any other spec being implemented first. If Spec B's verification needs code
from Spec A, they are the SAME spec — merge them. No spec references another
spec's output, interface, or data shape. Each spec is a closed system.

**Out of Scope prevents agent "helpfulness".** Agents love refactoring
adjacent code and adding "nice to have" features. An explicit DO NOT
TOUCH list is the most underrated section in any spec.

## The SCOPE Model

Each spec covers five areas:

- **S — Structure & Stack**: language + version, framework + version,
  database + version, key deps, exact file paths (CREATE/READ/EDIT/NEVER)
- **C — Constraints**: ✅ Always (automatic actions), ⚠️ Ask first
  (needs approval), 🚫 Never (hard stops — secrets, generated code,
  deleting tests, changing public API)
- **O — Outcomes**: Given/When/Then. Minimum 3: happy path, error state,
  edge case. Must be testable — if you can't write a test from it, it's
  too vague
- **P — Phases**: ordered implementation steps (create skeleton →
  models → handler → tests → verify). One spec = one phase
- **E — Examples**: real JSON request/response, SQL shapes, test output.
  Include where they reduce ambiguity

## Workflow

### Phase 1: Scope the Spec Set

Read PRD + design. Propose spec breakdown. **Every spec is an independent,
parallel unit.** If two features depend on each other at the implementation
level, they belong in the SAME spec — never split across specs. Present list
to user, get confirmation.

### Phase 2: Write Each Spec

For each spec: load `assets/spec-template.md`, fill from design doc.
For every requirement, ask "Could an agent misinterpret this?" If yes,
add specificity. Write GWT criteria; write verification command.

### Phase 3: Cross-Spec Validation

Check: every P0/P1 covered, no two specs CREATE/EDIT the same file, file
ownership doesn't conflict. Present to user for sign-off.

### Phase 4: Write to Disk

Save specs to `.plan/<DD-MM-YYYY>/<name>/specs/` as individual `.md` files.

## Gotchas

- **No PRD, no spec.** Missing PRD or design → stop and redirect.
- **Spec drift is worse than no spec.** A spec that disagrees with
  implementation misleads every future agent. If code changes, update the spec.
- **One verification command per spec.** If it covers multiple independently
  testable behaviors, split into multiple specs.
- **Don't inline the whole design doc.** Link to it. Include only the
  specific details that spec needs.
- **Spec template is structure-only.** `assets/spec-template.md` has
  `{{placeholder}}` tokens and headings only.

## References

- `assets/spec-template.md` — Per-spec structure with placeholders.
  Load during Phase 2 for each spec.
