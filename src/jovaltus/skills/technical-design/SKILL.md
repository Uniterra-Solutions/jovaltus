---
name: technical-design
description: >
  Dialectical technical design review and generation. Agent challenges
  every design decision with "why this and not something simpler?" Two
  modes: review an existing draft (question every choice, fill gaps) or
  design from requirements (interactive questions then propose, challenge
  own proposals). Produces design.md under .plan/<DD-MM-YYYY>/<name>/.
  LOAD when:
  - User says "let's design ..." or "review my design" or "技術設計"
  - User provides a design draft for review
  - After requirements-discovery produces a PRD and user is ready for design
  - User asks "what's the best architecture for ..."
  Do NOT use for:
  - Implementation, coding, debugging tasks
  - Requirements gathering (use requirements-discovery)
  - Code review of existing implementation
  - Choosing between two libraries (that's a spike/research task)
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [design, architecture, technical-review, dialectical, planning]
---

# Technical Design

## Goal

Produce a concrete, implementable technical design document through dialectical
questioning. Every design choice is challenged: "Why this? Why not simpler? If
there's a simpler approach, should we use it instead?"

The output is `design.md` in the same directory as the PRD:
`.plan/<DD-MM-YYYY>/<name>/design.md`.

## Acceptance Criteria

- Every major design decision has a documented rationale (why this, not that)
- Simpler alternatives were explicitly considered and either adopted or rejected
  with reasons
- Design is specific enough that an agent can implement without guessing
  (concrete: "PostgreSQL with table X, columns A/B/C, index on A" — not "a database")
- All design domains below are covered or explicitly marked N/A
- User has confirmed the design before the document is written
- User's preferences are respected unless demonstrably wrong for the requirements
  — then challenged with evidence, not dismissed

## Core Principles

**Dialectical, not confrontational.** Challenge design choices by exploring
alternatives, not by attacking the user's judgment. Every challenge comes with
a concrete alternative: "Microservices adds X complexity. A modular monolith
achieves the same separation with less operational overhead. What's driving
the microservices choice?"

**Burden of proof is on complexity.** Simple solutions are the default.
Complex solutions must justify themselves against the simpler alternative.
"Future-proofing" and "we might need it later" are not valid justifications
unless there's a concrete, planned requirement.

**PRD is the anchor.** Every design decision traces back to a PRD requirement.
If a design element doesn't serve a requirement, it's out of scope. If the PRD
is missing, direct the user to requirements-discovery first.

**Concrete over abstract.** "Use a message queue" is not a design decision.
"Use Redis Streams for the notification pipeline; producer writes to stream
`notifications`, worker group `notifiers` consumes with XREADGROUP" is.

**Design for known requirements, not speculative ones.** The design must handle
the scale, load, and features in the PRD. Extensibility is good — speculative
infrastructure is not.

## Two Modes

### Mode A: Review Existing Draft

User provides a design document or draft. Agent reviews it dialectically.

1. **Understand the draft.** Read it thoroughly. Map every design decision.
2. **For each decision, ask:**
   - Why this approach and not the simpler alternative?
   - What requirement does this serve?
   - What's the cost (complexity, operational, learning curve)?
   - Is there a way to achieve the same outcome with less?
3. **Identify gaps.** What design domains are missing? What questions does the
   draft leave open?
4. **Present findings.** Don't rewrite the draft immediately. Present:
   - Decisions that hold up under scrutiny
   - Decisions that need re-examination (with alternative proposals)
   - Gaps that need to be filled
5. **Revise collaboratively.** Work through the challenged decisions and gaps
   with the user. Update the draft incrementally.
6. **Confirm final design.** Present the complete design for sign-off.

### Mode B: Design from Requirements

User has a PRD but no design draft. Agent designs from scratch.

1. **Read the PRD.** It must exist at `.plan/<DD-MM-YYYY>/<name>/prd.md`.
   If not found, ask the user to run requirements-discovery first.
2. **Discover preferences.** Ask the user about constraints and preferences:
   - Required tech stack or languages (if any)
   - Existing systems to integrate with
   - Infrastructure preferences (cloud provider, self-hosted)
   - Team expertise and size
   - Any strong opinions or past negative experiences
3. **Propose architecture.** Based on PRD + preferences, propose a concrete
   architecture. For each proposal, pre-challenge yourself: what's the simpler
   alternative? Why is this the right choice?
4. **Present and defend.** Show the proposal, explain the rationale for each
   decision, and explicitly list the alternatives considered and why they were
   rejected. Invite the user to challenge back.
5. **Iterate.** Revise based on user feedback. If the user proposes something
   that contradicts the requirements, push back with evidence from the PRD.
6. **Confirm final design.** Present the complete design for sign-off.

## Design Domains

These are the areas the design must cover. Use as a coverage map — not a
questionnaire. The order follows natural dependency (architecture → data →
API → components → flows).

### 1. Architecture

Overall system shape. Deployment units, communication patterns, boundaries.

Cover: monolith vs services, sync vs async communication, deployment model,
request lifecycle overview.

### 2. Tech Stack

Concrete technology choices with rationale.

Cover: language, framework, database (type + specific product), caching layer,
message/event system, file storage, search engine, monitoring/observability.

For each: why this over the alternatives? What trade-offs are we accepting?

### 3. Data Model

Schema design. Tables, collections, key patterns.

Cover: entity definitions (same entities from PRD, now with concrete fields +
types + constraints), relationships (FKs, embedded, references), indexing
strategy (what queries need what indexes), migrations approach.

### 4. API Design

External interfaces. Endpoints, protocols, contracts.

Cover: API style (REST/GraphQL/gRPC), endpoint inventory with method + path +
purpose, request/response shapes (key fields, not exhaustive), auth mechanism,
versioning strategy, rate limiting approach.

### 5. Component / Module Breakdown

Internal structure. What are the modules, what does each own?

Cover: module inventory with single responsibility per module, module
boundaries (what's private, what's the public interface), dependency direction
(no cycles), key interfaces between modules.

### 6. Data Flow

How data moves through the system. Key scenarios traced end-to-end.

Cover: write path (user action → request → processing → storage → response),
read path (request → query → assembly → response), async/background flows,
event-driven chains.

### 7. Auth & Security

Who can do what. How is data protected?

Cover: authentication mechanism, authorization model (roles/permissions),
data protection (encryption at rest, in transit), input validation strategy,
CSRF/XSS/ injection prevention, secrets management.

### 8. Error Handling & Resilience

What happens when things fail.

Cover: error response format, retry strategy, circuit breaker pattern,
graceful degradation (what features still work when a dependency is down),
idempotency for mutating operations.

### 9. Infrastructure & Operations

How it runs in production.

Cover: hosting, containerization, CI/CD pipeline, logging, monitoring,
alerting, backup strategy, scaling approach.

### 10. Non-functional Design

Performance, scale, accessibility.

Cover: caching strategy (what, where, invalidation), database query
optimization, static asset delivery, load expectations with concrete numbers
from PRD, accessibility implementation approach.

## Document Output

### File Path

`.plan/<DD-MM-YYYY>/<name>/design.md`

Where `<DD-MM-YYYY>` and `<name>` match the PRD directory.

### Template

Load `assets/design-template.md` before writing. The template provides section
structure with `{{placeholder}}` tokens. Fill from the confirmed design.

### Writing Rules

- Use the same language as the design conversation
- Every technology choice must have a "Why" — one sentence rationale
- Every module must have a single responsibility statement
- Data model fields must include type and constraint
- API endpoints must include method, path, and purpose
- Prefer text-based diagrams (ASCII, mermaid) over descriptions of diagrams

## Gotchas

- **No PRD, no design.** If the PRD doesn't exist at the expected path, stop
  and direct the user to requirements-discovery. Designing without a PRD leads
  to scope creep and misalignment.
- **"We might need it later" is not a requirement.** If a design element
  exists only for speculative future needs, challenge it. Replace with an
  extension point (a hook, an interface) that costs nothing now and can be
  filled in later — don't build the implementation today.
- **Don't over-engineer for scale that isn't in the PRD.** If the PRD says
  100 users, don't design for 1M. Design for 100 with a clear migration path
  documented in the design if growth is expected.
- **User preferences aren't sacred.** If the user insists on a technology that
  objectively doesn't fit the requirements, push back — with evidence. "You
  want MongoDB but your data model is deeply relational with 12 join tables.
  PostgreSQL would reduce the code complexity by ~40%. Can we discuss this?"
- **Concrete means decisions made.** Don't write "consider using caching."
  Write "Use Redis for session cache, TTL 30 min, with PostgreSQL fallback if
  Redis is unavailable."
- **Design template is structure-only.** `assets/design-template.md` has
  `{{placeholder}}` tokens and section headings only. All behavioural guidance
  stays in this SKILL.md.

## References

- `assets/design-template.md` — Design document structure with `{{placeholder}}`
  tokens. Load before writing the final design.md.
