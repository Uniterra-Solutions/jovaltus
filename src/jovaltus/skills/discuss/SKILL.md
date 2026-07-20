---
name: discuss
description: >
  Interactive requirements elicitation through adaptive questioning.
  Agent starts from high-level project direction, follows user answers
  into detail, and does not stop until all 8 domains are covered.
  Produces a minimal PRD under .plan/<DD-MM-YYYY>/<name>/prd.md.
  LOAD when:
  - User describes a new project/feature idea or says "I want to build..."
  - User asks "help me plan..." or "can you write a PRD for..."
  - User says "我有一個 idea" or "幫我整理需求"
  Do NOT use for:
  - Existing, already-implemented systems
  - Code review, debugging, or refactoring
  - Technical architecture without product context
  - Specific how-to questions about an existing codebase
author: LaiTszKin
version: 0.1.1
metadata:
  jovaltus:
    tags: [requirements, planning, prd, discovery, product]
---

# Requirements Discovery

## Goal

Elicit a complete, unambiguous set of requirements through adaptive questioning.
Produce a minimal PRD that captures exactly what to build — nothing more.

## Acceptance Criteria

- All 8 domains covered or explicitly marked N/A with reason
- User confirmed the structured summary before PRD is written
- PRD: no implementation details, no tech stack decisions, no timeline/budget
- PRD is self-contained — implementable by a new agent with no conversation history
- PRD in same language as the conversation

## Core Principles

**Adaptive, not scripted.** The 8 domains are a coverage map, not a questionnaire.
Start with 2–3 open questions. Each answer reveals what to ask next. Follow the
user's answers down — don't recite a list.

**No leading questions.** "Who would use this?" not "Is this for teams?".
"What should happen when…?" not "Should it show an error?".

**Confirm before writing.** Present a structured summary. Wait for user
confirmation. Only then write the PRD.

**PRD describes WHAT, not HOW.** No tech stack unless the user imposed it
as a constraint. No architecture, no database choices, no framework picks.

## Questioning Framework — 8 Domains

Internal coverage map. Don't present to the user. Ask natural questions
that happen to cover these domains:

1. **Who & Why** — target users, problem, success metrics, scope boundaries
2. **Core Features** — what the system does, P0/P1/P2 prioritization,
   features from user perspective
3. **Data & Entities** — main entities, attributes, relationships,
   required vs optional fields, who creates/updates
4. **User Journeys** — key flows, onboarding, primary workflow, state
   transitions, permissions, what different users see
5. **Integrations** — external systems, third-party services, auth
   providers, payment, email, existing systems
6. **Non-functional** — expected load, response times, data sensitivity,
   auth, accessibility, i18n, browser/device support
7. **Constraints** — locked-in tech choices, deadline, team size,
   existing codebase, platform requirements
8. **Edge Cases & Errors** — failure scenarios, empty states, concurrency,
   network failure, data validation limits, abuse prevention

For each domain: drill until the user has no more details. If irrelevant:
mark N/A with reason.

## Workflow

### Phase 1: Orientation

Start with 2–3 broad questions from Domain 1. Don't present the framework.

### Phase 2: Deep Dive

For each answer: identify ambiguities, ask follow-ups. When a topic is
exhausted, pivot naturally to the next relevant domain. Keep going until
all 8 domains are covered or N/A.

### Phase 3: Confirm

Present a structured summary across all domains. Ask "Is this complete and
accurate? Anything missing or wrong?" Revise until confirmed.

### Phase 4: Write PRD

Determine path: `.plan/<DD-MM-YYYY>/<name>/prd.md`. Load
`assets/prd-template.md` for structure. Fill from confirmed summary.

### Phase 5: Offer Next Step

Ask: "Ready to move to technical design?"

## Gotchas

- **User says "I don't know."** Mark as "TBD — needs decision" in the PRD.
  Don't invent answers.
- **User keeps adding scope after confirmation.** Lock scope at Phase 3.
  New ideas go to "Future Considerations" — not current scope.
- **PRD must be implementable.** Self-check: could you build from this PRD
  alone (no conversation)? If not — what's missing? Add it.
- **Don't over-structure the conversation.** The framework is YOUR checklist.
  Ask natural questions that happen to cover the domains. Never recite
  domain names to the user.
- **Language consistency.** PRD must match the conversation language. Don't
  switch Chinese ↔ English mid-document.
- **No tech stack in PRD.** Unless the user imposed it as a hard constraint,
  put it only in the Constraints section. Don't pick technologies.

## References

- `assets/prd-template.md` — PRD structure with `{{placeholder}}` tokens.
  Load during Phase 4 before writing.
