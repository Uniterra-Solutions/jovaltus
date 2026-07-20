---
name: review
description: >
  Adversarial worktree code review via subagent. Spawns a review subagent
  inside each worktree that tries to BREAK the code — not just check it.
  Uses exhaustive enumeration: walks every branching path, violates every
  assumption, constructs multi-step failure cascades. Depth calibrates by
  risk signal (auth/payment → deep cascade analysis; CRUD → standard).
  Every fix demands an evidence test (fail before, pass after). Only
  after all checks pass does the orchestrator merge the branch and
  clean up the worktree.
  LOAD when:
  - execute has completed (all worktrees have implemented code)
  - User says "review" or "code review" or "審核" or "check the work"
  - Ready to gate worktree code before merging
  Do NOT use for:
  - Reviewing code that hasn't been implemented yet
  - Casual code review without structured adversarial methodology
  - Merge conflict resolution (that's post-review integration)
author: LaiTszKin
version: 0.2.0
metadata:
  jovaltus:
    tags: [review, adversarial, code-review, quality, merge, cleanup]
---

# Review

## Goal

For every completed worktree, spawn an **adversarial** review subagent that
tries to BREAK the code. Not "review for quality" — that catches ~13% of
deployment bugs (agentscamp 2026). Instead: systematically enumerate every
assumption the code makes and construct specific scenarios that violate them.
Walk every branching path mechanically. Build multi-step failure cascades.
Only code that survives adversarial interrogation gets merged.

Research (Refute-or-Promote, Systematic, BMAD Edge Case Hunter, GitHub's
Playbook) shows this approach catches 90%+ of issues. The remaining ~10%
are architectural problems, cross-service interactions, and scale-dependent
race conditions that no reviewer — human or AI — can catch in isolation.

## Acceptance Criteria

- Every task from the manifest has an adversarial review subagent spawned
- Each review subagent follows the 4-layer adversarial checklist
- **Depth is calibrated by risk**: auth/payment/data-mutation → deep cascade
  analysis; CRUD/utility → standard assumption violation + composition
- Every fix demanded by review includes an **evidence test** (fails before
  the fix, passes after)
- CI gaming is detected and rejected (removed tests, lowered coverage)
- After review passes, the orchestrator merges the branch and cleans up
- Failed reviews (unfixable issues) are reported; user decides

## Core Principles

**Adversarial, not checklist.** Traditional review asks "does this code
follow best practices?" That catches 13% of bugs. Adversarial review asks
"how does this code FAIL?" — and enumerates the answer exhaustively.
The reviewer is a chaos engineer, not a quality auditor.

**Fresh context is load-bearing.** The review subagent runs in a clean
`hermes chat -q` session with no memory of the implementation conversation.
It reads TASK.md (the spec) and the code (the implementation) — nothing
else. Same agent reviewing its own code = expensive rubber stamp.

**Exhaustive enumeration over intuition.** "Did you handle edge cases?"
produces 3-4 checks from memory. Systematic enumeration walks every:
- Branching path (if/else, switch, early return, exception handler)
- Boundary condition (null, empty, max, min, zero, negative, unicode)
- Assumption (data shape, timing, ordering, value range)
- Failure cascade (A fails → B retries → C exhausts)

**Depth calibrates by risk, not diff size.** A 5-line auth change gets
deep cascade analysis. A 200-line CRUD endpoint gets standard review.
Risk signals: authentication, authorization, payment, billing, data
migration, external API, webhook, cryptography, session, PII.

**Evidence test or the fix didn't happen.** Every bug fix must include
a test that FAILS on the pre-fix code and PASSES on the post-fix code.
Without this, the reviewer cannot prove the fix actually works.

## Prerequisites

1. Manifest exists at `.plan/<DD-MM-YYYY>/<name>/tasks/manifest.md`
2. Worktrees exist with implemented code and TASK.md
3. `execute` has completed

## Workflow

### Phase 1: Determine Merge Target

1. Identify the original working branch. Confirm with user.

### Phase 2: Calibrate Review Depth Per Task

2. For each task, read its TASK.md. Classify risk level:
   - **DEEP**: auth, payment, billing, data-mutation, external API,
     cryptography, session, PII, webhook, migration
   - **STANDARD**: CRUD endpoints, business logic, data processing
   - **QUICK**: utility functions, config changes, documentation

3. Select review technique based on risk:
   - DEEP → all 4 layers of the adversarial checklist
   - STANDARD → layers 1-3 (skip cascade construction)
   - QUICK → layers 1-2 (assumption violation + composition only)

### Phase 3: Spawn Adversarial Review Subagents

4. For every task, spawn simultaneously:
   ```
   terminal(
       command="hermes chat -q \"<adversarial-review-prompt>\"",
       workdir=".worktrees/<id>-<slug>",
       background=true,
       notify_on_complete=true,
       timeout=1800
   )
   ```

### Phase 4: Collect + Merge

5. Wait for all reviews. Per task: ✅ passed → merge + cleanup.
   🔴 blocked → report, user decides.

## Adversarial Review Prompt

The prompt injected into each review subagent. It loads the full checklist
from `references/review-checklist.md`:

```
You are an ADVERSARIAL CODE REVIEWER — a chaos engineer who reads code by
trying to BREAK it. You do not evaluate code quality. You construct specific
scenarios that make the code FAIL.

FIRST: Read TASK.md. Understand what this code was SUPPOSED to do.

SECOND: Read every file in the File Ownership section. Read tests.

THIRD: Run the verification command. Note baseline.

FOURTH: Calibrate your review depth:
  - DEEP: auth, payment, data, external API, crypto, session, PII
    → Run ALL FOUR layers (assumptions + composition + cascades + evidence)
  - STANDARD: CRUD, business logic
    → Run layers 1-3 (assumptions + composition + edge enumeration)
  - QUICK: utilities, config
    → Run layers 1-2 (assumptions + composition)

FIFTH: Execute the adversarial review. For each layer, work through every
category systematically. Do not skip. Do not use intuition — ENUMERATE.

SIXTH: For every issue found, FIX IT immediately in this worktree. After
each fix, re-run verification. If a fix breaks something, fix that too.

SEVENTH: For every fix, create an EVIDENCE TEST: a test that FAILS on the
pre-fix behavior and PASSES on the post-fix behavior. No evidence test =
the fix is unverified.

EIGHTH: Report your verdict. Every layer must have an explicit answer.

--- Load references/review-checklist.md for the full 4-layer checklist ---
```

## Gotchas

- **Fresh context is mandatory.** Never let the same agent session that
  implemented the code also review it. The review subagent must be a
  separate `hermes chat -q` process with no implementation memory.
- **CI gaming is the first thing to check.** Agents that fail CI have an
  obvious escape: remove the failing test, skip lint, lower coverage.
  Check `.github/workflows/`, CI config, and coverage thresholds FIRST.
- **Evidence tests prove the fix works.** "Added null check" is a claim.
  `test_returns_400_on_null_input` that fails before and passes after is
  proof. Demand evidence tests for every fix.
- **Cross-model review catches more.** If possible, use a different model
  for review than for implementation. Claude → implement; Gemini → review.
  Different model families have different blind spots (Refute-or-Promote).
- **Assumption violations are the #1 missed bug class.** For every
  function, enumerate: what does it assume about its inputs? About timing?
  About state? About the external world? Then violate each assumption.
- **The last 10% can't be caught here.** Cross-service interactions,
  production-scale race conditions, and architectural problems that only
  surface under load are invisible in a single worktree. These need an
  integration test phase after merge.

## References

- `references/review-checklist.md` — 4-layer adversarial checklist with
  depth calibration, assumption violation enumeration, composition
  failure analysis, cascade construction, and evidence test protocol.
