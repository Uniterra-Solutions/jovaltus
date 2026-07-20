---
name: requirements-discovery
description: >
  Interactive requirements elicitation through adaptive questioning.
  Agent starts from high-level direction, drills into detail based on
  user answers, and does not stop until every domain is covered.
  Produces a minimal PRD under .plan/<DD-MM-YYYY>/<name>/prd.md.
  LOAD when:
  - User says "I want to build ..." or describes a new project/feature idea
  - User asks "help me plan ..." or "can you write a PRD for ..."
  - User explicitly requests requirements gathering or discovery
  - User says "我有一個 idea" or "幫我整理需求"
  Do NOT use for:
  - User asks about an existing, already-implemented system
  - User wants code review, debugging, or refactoring
  - User asks for technical architecture without product context
  - User asks a specific how-to question about an existing codebase
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [requirements, planning, prd, discovery, product]
---

# Requirements Discovery

## Goal

Guide the user through adaptive questioning to elicit a complete, unambiguous
set of requirements. Produce a minimal PRD that captures exactly what needs to
be built — nothing more.

The output is a single `prd.md` file at `.plan/<DD-MM-YYYY>/<requirement_name>/prd.md`.

## Acceptance Criteria

- Every domain listed below has been explicitly covered or confirmed as N/A
- User has confirmed the structured summary before PRD is written
- PRD contains no implementation details, no tech stack decisions (unless user
  specified them as constraints), no timeline, no budget
- PRD is self-contained — a new agent reading it can implement without asking
  follow-up questions
- PRD uses the same language as the discovery conversation

## Core Principles

**Adaptive, not scripted.** The 8 domains below are a coverage map, not a
questionnaire. Start broad — ask 2–3 open questions. Each answer reveals what
to ask next. Follow the user's answers down, not a pre-written list.

**No leading questions.** Ask "who would use this?" not "is this for teams?".
Ask "what should happen when …?" not "should it show an error?".

**Exhaust every domain.** Before writing the PRD, confirm every domain in the
framework has been addressed. If a domain is genuinely irrelevant, mark it
N/A with a one-line reason.

**Confirm before writing.** Present a structured summary of all discovered
requirements. Wait for user confirmation. Only then write the PRD.

## Questioning Framework — 8 Domains

Work through these domains adaptively. The order is a guide; follow the
conversation. For each domain, drill until the user has no more details to add.

### 1. Who & Why

Who are the users? What problem does this solve? What does success look like?

Start with:
- "Who is this for? Describe your target users."
- "What problem are you solving for them?"
- "How do you know this is successful? What's the one key outcome?"

Drill into: user personas, their current workflow/pain, success metrics,
project scope boundaries.

### 2. Core Features

What does the system *do*? What are the must-haves vs nice-to-haves?

Start with:
- "If you could only ship 3 things, what would they be?"
- "Walk me through the main thing a user does."

Drill into: feature priority (P0/P1/P2), what each feature does from user
perspective, dependencies between features.

### 3. Data & Entities

What information does the system manage? How are things related?

Start with:
- "What are the main 'things' in this system? (e.g. users, orders, tasks)"
- "How are they connected to each other?"

Drill into: key attributes per entity, relationships (one-to-many etc.),
required vs optional fields, who creates/updates each entity, data retention.

### 4. User Journeys

What are the key flows a user goes through? What states exist?

Start with:
- "Walk me through a user's first experience from start to finish."
- "What are the different states a [core entity] can be in?"

Drill into: onboarding, primary workflow, secondary flows, state transitions,
permissions per role, what different user types see.

### 5. Integrations & Dependencies

What external systems does this connect to? What does it depend on?

Start with:
- "Does this need to connect to any existing systems or services?"
- "Are there any third-party services it must work with?"

Drill into: auth provider, payment, email, storage, external APIs,
data import/export, existing systems it must coexist with.

### 6. Non-functional

Performance, security, scale, accessibility, i18n, reliability.

Start with:
- "How many users do you expect? Concurrent?"
- "Are there any security or compliance requirements?"
- "Does this need to work in multiple languages or regions?"

Drill into: expected load, response time expectations, data sensitivity,
auth requirements, accessibility standards, browser/device support.

### 7. Constraints

What are the hard boundaries? Timeline, team, tech, budget.

Start with:
- "Are there any technology choices already locked in?"
- "Is there a deadline or timeline constraint?"

Drill into: required tech stack (if any), team size, existing codebase
constraints, budget constraints, platform requirements.

### 8. Edge Cases & Errors

What goes wrong? What are the boundary conditions?

Start with:
- "What happens when things go wrong? List the failure scenarios."
- "What are the limits? (max users, max items, max file size)"

Drill into: error states per feature, empty states, concurrent access
conflicts, network failure, data validation edge cases, rate limiting,
abuse prevention.

## Workflow

### Phase 1: Orientation

1. Load this skill when user expresses a project idea.
2. Start with 2–3 broad questions from Domain 1 (Who & Why).
3. Do NOT present the 8-domain framework to the user — it's your internal
   coverage map. Let the conversation feel natural.

### Phase 2: Deep Dive

4. For each answer: identify ambiguities, ask follow-ups.
5. When a topic is exhausted, pivot naturally: "You mentioned X — let me ask
   about how that connects to …" and move to the next relevant domain.
6. Track which domains are covered. Keep going until all 8 domains have been
   addressed or explicitly marked N/A.

### Phase 3: Confirm

7. Present a structured summary covering all 8 domains:
   ```
   ## Requirements Summary
   ### 1. Who & Why
   - [key points]
   ### 2. Core Features
   - P0: ...
   - P1: ...
   ...
   ### 8. Edge Cases
   - [key points]
   ```
8. Ask: "Is this complete and accurate? Anything missing or wrong?"
9. Revise based on feedback. Repeat until user confirms.

### Phase 4: Write PRD

10. Determine output path:
    - `<DD-MM-YYYY>` = today's date
    - `<requirement_name>` = kebab-case from user's project name
    - Path: `.plan/<DD-MM-YYYY>/<requirement_name>/prd.md`
11. Load `assets/prd-template.md` for structure.
12. Write the PRD. Follow the template structure. Fill in from the confirmed
    summary. Use the same language as the conversation.
13. Tell the user: "PRD written to `.plan/<DD-MM-YYYY>/<name>/prd.md`"

### Phase 5: Offer Next Step

14. Ask: "Ready to start implementation, or would you like to revise anything?"

## Gotchas

- **User says "I don't know" or "I haven't thought about that."** This is a
  signal, not a blocker. Note it in the PRD as "TBD — needs decision" and
  move on. Don't invent answers.
- **User keeps adding scope.** After Phase 3 confirmation, lock the scope.
  New ideas go into a "Future Considerations" section in the PRD, not into
  the current scope.
- **PRD must be implementable.** After writing, self-check: if you were handed
  only this PRD (no conversation history), could you build it? If not, what's
  missing? Add it.
- **Don't over-structure the conversation.** The 8-domain framework is your
  internal checklist. Don't recite domain names to the user. Ask natural
  questions that happen to cover the domains.
- **PRD template is structure-only.** `assets/prd-template.md` has
  `{{placeholder}}` tokens and section headings. It contains no instructions,
  no examples, no rules. All behavioural guidance stays in this SKILL.md.
- **Language consistency.** The PRD must use the same language as the
  discovery conversation. Don't switch to English if the user spoke Chinese,
  and vice versa.
- **No tech stack in PRD (unless user imposed it).** The PRD describes *what*,
  not *how*. If the user specified a required technology, put it in the
  Constraints section only. Don't pick technologies for them.

## References

- `assets/prd-template.md` — PRD structure template with `{{placeholder}}`
  tokens. Load during Phase 4 before writing.
