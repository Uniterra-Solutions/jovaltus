---
name: design
description: >
  Dialectical technical design. Agent challenges every design decision:
  "Why this and not something simpler?" Two modes: review an existing
  draft (question every choice, fill gaps) or design from requirements
  (propose, challenge own proposals, iterate with user). Produces
  design.md under .plan/<DD-MM-YYYY>/<name>/.
  LOAD when:
  - User says "design..." or "review my design" or "技術設計"
  - After discuss produces a PRD and user is ready for design
  - User asks "what's the best architecture for..."
  Do NOT use for:
  - Implementation, coding, or debugging
  - Requirements gathering (use discuss)
  - Code review of existing implementation
  - Choosing between two libraries (spike/research task)
author: LaiTszKin
version: 0.1.1
metadata:
  jovaltus:
    tags: [design, architecture, technical-review, dialectical, planning]
---

# Technical Design

## Goal

Produce a concrete, implementable design through dialectical questioning.
Every choice challenged: "Why this? Why not simpler? What's the cost?"

## Acceptance Criteria

- Every major decision has rationale: why this, alternatives rejected + reason
- Simpler alternatives explicitly considered and adopted or rejected
- Design is specific enough for agent implementation without guessing
- All 10 design domains covered or marked N/A
- User confirmed the design before the document is written

## Core Principles

**Burden of proof is on complexity.** Simple is default. Complex solutions
must justify themselves. "Future-proofing" and "we might need it later"
are not valid unless there's a concrete, planned requirement.

**PRD is the anchor.** Every decision traces to a PRD requirement. If it
doesn't serve a requirement, it's out of scope. No PRD → redirect to discuss.

**Concrete over abstract.** "Use a message queue" is not a decision.
"Use Redis Streams for notifications; producer writes to `notifications`
stream, worker group `notifiers` consumes with XREADGROUP" is.

**Design for known requirements, not speculative ones.** The design handles
the scale, load, and features in the PRD. Extensibility points are good;
speculative infrastructure is not.

**Dialectical, not confrontational.** Challenge with alternatives, not
attacks. "Microservices adds X complexity. A modular monolith achieves
the same separation with less overhead. What's driving the choice?"

## Two Modes

### Mode A: Review Existing Draft

1. Map every design decision in the draft
2. For each: why this? what requirement does it serve? what's the cost?
   is there a simpler way?
3. Identify gaps — which design domains are missing?
4. Present: what holds up, what needs re-examination, what gaps exist
5. Revise collaboratively, confirm final design

### Mode B: Design from Requirements

1. Read PRD (must exist at `.plan/<date>/<name>/prd.md`)
2. Discover preferences: required tech, existing integrations, infra,
   team expertise, strong opinions
3. Propose architecture. Pre-challenge every proposal: what's simpler?
4. Present + defend: explicit alternatives considered + why rejected
5. Iterate with user feedback. Push back if proposals contradict the PRD
6. Confirm final design

## Design Domains

Coverage map. Use as checklist — not a questionnaire. Natural dependency order:

1. **Architecture** — system shape, deployment units, communication patterns,
   sync vs async, request lifecycle
2. **Tech Stack** — language, framework, database, cache, messaging, storage,
   search, monitoring. Each with rationale
3. **Data Model** — entities from PRD → concrete fields + types + constraints,
   relationships, indexes, migrations
4. **API Design** — style (REST/GraphQL/gRPC), endpoint inventory, request/
   response shapes, auth mechanism, versioning, rate limiting
5. **Components/Modules** — single responsibility per module, boundaries
   (public interface vs private), dependency direction (no cycles)
6. **Data Flow** — write path, read path, async flows, event chains. Trace
   key scenarios end-to-end
7. **Auth & Security** — auth mechanism, authorization model, data protection,
   input validation, CSRF/XSS/injection prevention, secrets management
8. **Error Handling** — error response format, retry strategy, circuit
   breakers, graceful degradation, idempotency
9. **Infrastructure** — hosting, containerization, CI/CD, logging,
   monitoring, alerting, backup, scaling
10. **Non-functional** — caching, query optimization, static assets, load
    expectations (concrete numbers from PRD), accessibility

## Document Output

Write `.plan/<DD-MM-YYYY>/<name>/design.md`. Load `assets/design-template.md`
for structure. Rules:
- Same language as the design conversation
- Every tech choice: one-sentence rationale
- Every module: single responsibility statement
- Data model fields: type + constraint included
- Prefer text diagrams (ASCII, mermaid) over descriptions

## Gotchas

- **No PRD, no design.** Stop and redirect to discuss if PRD is missing.
- **"We might need it later" is not a requirement.** Challenge speculative
  elements. Extension points (hooks, interfaces) are fine; don't build
  the implementation today.
- **Don't over-engineer for phantom scale.** PRD says 100 users → design
  for 100 with a migration path, not for 1M from day one.
- **User preferences aren't sacred.** If the user insists on a technology
  that objectively doesn't fit, push back with evidence. "You want MongoDB
  but your data model is deeply relational with 12 join tables. PostgreSQL
  would reduce complexity. Can we discuss?"
- **Concrete means decisions made.** Not "consider using caching" — "Use
  Redis for session cache, TTL 30 min, with PostgreSQL fallback."
- **Design template is structure-only.** `assets/design-template.md` has
  `{{placeholder}}` tokens and section headings only.

## References

- `assets/design-template.md` — Design document structure with placeholders.
  Load before writing final design.md.
