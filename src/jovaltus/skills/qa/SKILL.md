---
name: qa
description: >
  PRD-driven acceptance testing across all app types. Extracts every
  user-facing requirement from the PRD as a testable user journey and
  exercises each as a real user — browser for web, terminal for CLI/API,
  computer-use for desktop, execute_code for libraries. Fixes issues
  immediately with regression tests; loops until all requirements pass.
  Produces a QA report mapping requirements to evidence.
  LOAD when:
  - All worktrees merged, code integrated on the working branch
  - User says "qa" or "test" or "驗收" or "試用"
  - Ready to verify the integrated app against the PRD
  Do NOT use for:
  - Unit or integration testing (that's review phase)
  - Testing before all worktrees are merged
  - Performance or load testing
author: LaiTszKin
version: 0.1.1
metadata:
  jovaltus:
    tags: [qa, acceptance, testing, prd-driven]
---

# QA

## Goal

Exercise every PRD requirement as a complete user journey — find bugs, fix
them with regression tests, re-run, repeat. Stop when every requirement
produces the expected outcome. This is the final gate before shipping.

## Acceptance Criteria

- Every PRD user-facing requirement → exercised as a journey (not isolated check)
- Each journey: ✅ PASS or 🔴 FAIL with evidence
- Issues found → fixed immediately + regression test + re-run
- QA report maps every requirement → journey → outcome → evidence
- Unfixable issues escalated with reproduction steps (not guessed at)

## Core Principles

**PRD is the contract.** Every user-facing requirement becomes a user journey.
"Users can register with email" becomes: signup → confirm → login → dashboard
→ logout. Exercise the full journey, not just the signup endpoint.

**Flows, not features.** A page test says "login works." A journey says
"register → confirm email → login → see correct dashboard → logout."
Bugs live between the steps.

**Fix immediately.** Don't just report — fix, add a regression test,
re-run the journey. Iterate until it passes. Only escalate when the fix
needs: a design decision, missing infrastructure, or ambiguous spec.

**App-type agnostic.** Auto-detect from PRD/design and use the right tools:
web apps → browser, CLI → terminal, APIs → curl, desktop → computer-use,
libraries → execute_code. See `references/app-type-examples.md` for
tool-specific patterns.

**Evidence for every verdict.** Pass or fail, capture the proof:
screenshots (web), terminal output (CLI/API), response dumps (API).

## Workflow

### Phase 1: Detect App Type

Read PRD + design. Determine app type. If uncertain, ask.

### Phase 2: Extract Journeys

For each PRD requirement, define a complete user journey: entry point,
every step, every branch (validation errors, empty states, permission
denied), every side effect, the true end state. Build a journey matrix
mapping each requirement to its journey and expected outcomes.

Prioritize: critical flows first, then secondary, then edge cases.

### Phase 3: Start the App

Detect run command from project config (package.json scripts, Makefile,
README.md). Start in background, wait for ready signal.

### Phase 4: Execute + Fix Loop

For each journey in priority order:

1. Announce the journey, execute every step with the right toolset
2. If ✅ PASS → capture evidence, move on
3. If 🔴 FAIL → diagnose source → fix code → add regression test →
   re-run journey from step 1 → iterate
4. If unfixable (design flaw, missing infra, ambiguous spec) →
   escalate with repro steps, move on

### Phase 5: Report

Write `.plan/<DD-MM-YYYY>/<name>/qa-report.md`:

```markdown
# QA Report — {{plan-name}}

## Summary
| Metric | Count |
|--------|-------|
| Total journeys | N |
| Passed | X |
| Failed → Fixed | Y |
| Escalated | Z |

## Journey Results
For each journey: verdict, toolset, evidence reference, fixes applied,
regression tests added.

## Escalations
For each: which requirement, what's broken, why it can't be fixed here,
recommendation.
```

## Gotchas

- **Journeys, not unit tests.** A unit test checks `create_user()` returns
  an ID. A journey checks: register → confirm → login → see correct data →
  logout. The gaps between steps are where bugs hide.
- **One server instance, entire test run.** Don't restart between journeys.
- **Test data hygiene.** Use unique identifiers per journey so they don't
  collide. Clean up after each journey or at the end.
- **Realistic test data.** No "test", "foo", "123". Realistic names/emails
  surface rendering and validation issues better.
- **Console errors are bugs.** Even if the UI looks fine, a red console is
  a finding. Check after every interaction.
- **Empty states break most often.** Test every list with zero items, every
  dashboard with a new user.
- **Escalate, don't guess.** If the cause is unclear or the fix needs a
  design decision, escalate with reproduction steps. Don't assume what
  the behavior should be.
- **PRD is source of truth.** If behavior ≠ PRD, flag it. Either the code is
  wrong (fix) or the PRD is wrong (update). Never silently accept the gap.

## References

- `references/app-type-examples.md` — Tool-specific commands for each
  app type (browser, terminal/curl, computer-use, execute_code).
