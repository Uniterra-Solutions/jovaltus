---
name: implementation-spec
description: >
  Translates PRD and technical design into agent-executable implementation
  specs. Each spec is a self-contained task with concrete stack, exact
  file paths, GWT acceptance criteria, three-tier boundaries, and a
  verification command. Uses the SCOPE framework (Structure, Constraints,
  Outcomes, breakdown, Examples) adapted for implementation.
  LOAD when:
  - PRD and design doc exist and user is ready to spec out implementation
  - User says "write the spec" or "break this into tasks" or "implementation spec"
  - User asks for executable task breakdown from existing PRD + design
  Do NOT use for:
  - Requirements gathering or PRD writing (use requirements-discovery)
  - Technical design or architecture decisions (use technical-design)
  - Writing code directly — this produces specs, not code
  - Tasks without a design doc to reference
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [implementation, spec, scoope, tasks, agent-executable, planning]
---

# Implementation Spec

## Goal

Translate a PRD and technical design into a set of agent-executable
implementation specs. Each spec is a self-contained task that an agent
can pick up and execute without asking follow-up questions.

The output is one or more spec files under
`.plan/<DD-MM-YYYY>/<name>/specs/`. Each spec covers exactly one
implementable unit of work.

## Acceptance Criteria

- Every spec is self-contained — a new agent session reading only that spec
  (plus the design doc for reference) can implement it without ambiguity
- Every spec has at least 3 Given/When/Then acceptance criteria covering
  happy path, error state, and edge case
- Every spec names exact files to create, read, and edit
- Every spec includes a concrete verification command that produces pass/fail
- Every spec uses concrete field names, types, and constraints from the
  design doc — never "a field for the name"
- Three-tier boundaries on every spec
- All specs together cover every P0 and P1 feature from the PRD

## Core Principles

**The spec's job is to remove decisions.** Every blank the spec leaves is a
decision the agent will make — and get wrong. "Handle errors" becomes a 200
with empty body; "use a database" becomes SQLite because it's most common
in training data. The spec must leave zero blanks.

**Concrete over abstract.** "Store the user's email" → "Table `users`, column
`email` VARCHAR(255) UNIQUE NOT NULL". "Return an error" → "Return HTTP 409,
body `{"error": "EMAIL_EXISTS", "message": "This email is already registered"}`".

**Given/When/Then for every behavior.** This format forces you to name the
trigger, the action, and the expected result. If you can't write a GWT for
a requirement, it's not specific enough yet.

**One spec = one agent session.** Each spec should be completable in 15-30
minutes by an agent. If a spec would take longer, split it further.

**Out of Scope is mandatory.** Telling the agent what NOT to do prevents it
from "helpfully" refactoring adjacent code, adding "nice to have" features,
or touching files outside its remit.

## Prerequisites

Before starting, verify:
1. PRD exists at `.plan/<DD-MM-YYYY>/<name>/prd.md`
2. Design doc exists at `.plan/<DD-MM-YYYY>/<name>/design.md`

If either is missing, redirect the user to the appropriate skill:
- Missing PRD → `requirements-discovery`
- Missing design → `technical-design`

## The SCOPE Model for Implementation Specs

Adapted from the industry-standard SCOPE framework, each implementation
spec covers five areas:

### S — Structure & Stack

Pin the exact technology context so the agent doesn't guess.

- Language + version: "Python 3.12"
- Framework + version: "FastAPI 0.115"
- Database + version: "PostgreSQL 16"
- Key dependencies the task uses (not the whole project)
- Exact file paths for: files to CREATE, files to READ (context only),
  files to EDIT, files to NEVER touch

### C — Constraints (Three-Tier Boundaries)

✅ **Always** — actions the agent should take without asking:
- Run the verification command before declaring done
- Follow existing naming conventions in touched files
- Add type annotations for all new functions
- Write tests alongside implementation

⚠️ **Ask first** — actions that need human approval:
- Adding a new dependency
- Modifying the database schema
- Changing a file not listed in "May edit"
- Introducing a new architectural pattern

🚫 **Never** — hard stops:
- Commit secrets or .env files
- Edit generated code or vendor directories
- Delete or weaken existing tests
- Change the public API of exported functions without explicit instruction

### O — Outcomes (Acceptance Criteria)

Every behavior is specified as Given/When/Then. Minimum 3 per spec:

- **Happy path:** The primary success case
- **Error state:** At least one failure mode
- **Edge case:** Empty/null/boundary condition

Format:
```
- Given <precondition>, When <action>, Then <observable result>
```

Bad: "Handle invalid input" → Good: "Given email field is empty, When POST
/api/auth/register, Then return HTTP 422, body `{"error": "VALIDATION",
"fields": {"email": "required"}}`"

### P — Phases (Task Breakdown)

Each spec is a single phase — one unit of work. If a feature requires
multiple dependent steps, create multiple specs with clear ordering.

A spec should contain an ordered checklist of implementation steps:
```
### Steps
1. Create the route file with endpoint skeleton
2. Add Pydantic models for request/response
3. Implement the handler logic
4. Write tests
5. Run verification
```

### E — Examples

Include concrete examples where they reduce ambiguity:

- Request/response body examples (real JSON, not descriptions)
- SQL query shapes if the query is non-trivial
- Expected test output format

## Workflow

### Phase 1: Scope the Spec Set

1. Read the PRD. Identify all P0 and P1 features.
2. Read the design doc. Map each feature to its technical implementation.
3. Determine the task breakdown: which features are independent (can be
   parallel specs) vs dependent (must be sequential specs).
4. Present the proposed spec list to the user:
   ```
   ## Proposed Specs
   1. `01-user-registration.md` — POST /api/auth/register
   2. `02-user-login.md` — POST /api/auth/login + JWT issuance
   3. `03-database-migrations.md` — Initial schema (prerequisite for 1, 2)
   ...
   ```
5. Get user confirmation on the breakdown.

### Phase 2: Write Each Spec

For each spec in the confirmed list:

1. Load `assets/spec-template.md` for structure.
2. Fill every section with concrete details from the design doc.
3. For each requirement, ask: "Could an agent misinterpret this?" If yes,
   add specificity until the answer is no.
4. Write Given/When/Then acceptance criteria. Check: can a test be written
   from each one? If not, it's too vague.
5. Define exact files: create, read (context), edit, never touch.
6. Write a verification command that produces a clear pass/fail.

### Phase 3: Cross-Spec Validation

After all specs are written:

1. Check that every P0 and P1 feature from the PRD is covered by at least
   one spec.
2. Check that dependency order is correct (spec 03 before 01 if 01 depends
   on 03's output).
3. Check that file ownership doesn't conflict (no two specs edit the same
   file unless they're strictly sequential).
4. Present the complete spec set to the user for sign-off.

### Phase 4: Write Specs to Disk

1. Create the specs directory: `.plan/<DD-MM-YYYY>/<name>/specs/`
2. Write each spec as a separate `.md` file using the template structure.
3. Report file paths to the user.

## Document Output

### Directory Structure

```
.plan/<DD-MM-YYYY>/<name>/
├── prd.md
├── design.md
└── specs/
    ├── 01-<task-name>.md
    ├── 02-<task-name>.md
    └── ...
```

### Template

Load `assets/spec-template.md` for the canonical structure. Fill from
the design doc and PRD. Use the same language as the conversation.

## Gotchas

- **No PRD, no spec.** If the PRD or design doc doesn't exist at the
  expected path, stop and redirect. Specs written without a design doc
  will drift because the agent will fill technical gaps with guesses.
- **Spec drift is worse than no spec.** A spec that says "use table X"
  when the actual implementation uses table Y will mislead every future
  agent session. If implementation changes, update the spec.
- **"Handle" and "support" are banned words in specs.** If a requirement
  uses these words, it's not specific enough. Replace with exact behavior.
- **One verification command per spec.** If the spec covers multiple
  independently testable behaviors, it should be multiple specs. The
  verification command must cover ALL acceptance criteria in that spec.
- **Don't inline the whole design doc.** Each spec references the design
  doc (link to it) but only includes the specific details that task needs.
  This keeps specs scannable and prevents context bloat.
- **Out of Scope is the most underrated section.** Agents love to
  "improve" nearby code. An explicit DO NOT TOUCH list prevents speculative
  refactors, unrelated "cleanup," and scope creep.
- **Template is structure-only.** `assets/spec-template.md` has
  `{{placeholder}}` tokens and section headings only. All behavioural
  guidance stays in this SKILL.md.

## References

- `assets/spec-template.md` — Per-task spec structure with `{{placeholder}}`
  tokens. Load during Phase 2 for each spec.
