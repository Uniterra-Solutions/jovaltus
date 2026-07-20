---
name: review
description: >
  Adversarial worktree code review via subagent. Spawns a review subagent
  inside each worktree that tries to BREAK the code — not just check it.
  Exhaustive enumeration: walks every branching path, violates every
  assumption, constructs multi-step failure cascades. Depth calibrates by
  risk signal (auth/payment → deep; CRUD → standard). Every fix demands
  an evidence test (fail before, pass after). Merges branches and cleans
  up worktrees after passing review.
  LOAD when:
  - execute has completed (all worktrees have implemented code)
  - User says "review" or "code review" or "審核"
  - Ready to gate worktree code before merging
  Do NOT use for:
  - Code that hasn't been implemented yet
  - Casual review without adversarial methodology
  - Merge conflict resolution (post-review integration)
author: LaiTszKin
version: 0.2.1
metadata:
  jovaltus:
    tags: [review, adversarial, code-review, quality, merge, cleanup]
---

# Review

## Goal

Spawn an adversarial review subagent per worktree that tries to BREAK the
code. Systematic assumption violation, exhaustive path enumeration, cascade
construction. Only surviving code gets merged. Catches 90%+ of issues
(Refute-or-Promote, Systematic, BMAD Edge Case Hunter).

The remaining ~10% — architectural problems, cross-service interactions,
scale-dependent race conditions — are invisible in single-worktree isolation.

## Acceptance Criteria

- Every manifest task gets an adversarial review subagent
- Depth calibrated by risk: DEEP (auth/payment/crypto) → 4 layers;
  STANDARD (CRUD) → 3 layers; QUICK (utility) → 2 layers
- Every fix has an evidence test (fails before, passes after)
- CI gaming detected and rejected (removed tests, lowered coverage)
- ✅ passed → merge branch + cleanup worktree
- 🔴 blocked (unfixable) → reported; user decides

## Core Principles

**Adversarial, not checklist.** "Does this follow best practices?" catches
~13% of bugs. "How does this FAIL?" with exhaustive enumeration catches 90%+.
The reviewer is a chaos engineer, not a quality auditor.

**Fresh context is load-bearing.** Review subagent = clean `hermes chat -q`
session, no implementation memory. Reads only TASK.md + code. Same agent
reviewing its own code = expensive rubber stamp.

**Depth calibrates by risk, not diff size.** A 5-line auth change gets
deep cascade analysis. A 200-line CRUD endpoint gets standard review.

**Evidence test = proof of fix.** "Added null check" is a claim.
`test_returns_400_on_null_input` failing before and passing after is proof.

## Workflow

### Phase 1: Determine Merge Target

Identify the working branch. Confirm with user.

### Phase 2: Calibrate Depth Per Task

For each task's TASK.md, classify risk:
- **DEEP**: auth, payment, crypto, PII, session, webhook, migration
- **STANDARD**: CRUD, business logic, data processing
- **QUICK**: utility, config, docs

### Phase 3: Spawn Adversarial Reviews

For every task simultaneously:
```
terminal(
    command="hermes chat -q '<adversarial-review-prompt>'",
    workdir=".worktrees/<id>-<slug>",
    background=true,
    notify_on_complete=true,
    timeout=1800
)
```

### Phase 4: Collect + Merge

Wait all reviews. ✅ → merge + cleanup. 🔴 → report, user decides.

## Adversarial Review Prompt

Injected into each review subagent. Loads `references/review-checklist.md`
for the full 4-layer checklist:

```
You are an ADVERSARIAL CODE REVIEWER — a chaos engineer who tries to BREAK
code. You do not evaluate quality. You construct specific failure scenarios.

FIRST: Read TASK.md. Understand what this code was SUPPOSED to do.

SECOND: Read every file in File Ownership. Read tests.

THIRD: Run verification command. Note baseline.

FOURTH: Calibrate depth by risk signal in TASK.md.

FIFTH: Execute adversarial review. For each layer, work through every
category systematically. ENUMERATE — do not use intuition.

SIXTH: For every issue, FIX immediately in this worktree. Re-run
verification after each fix.

SEVENTH: For every fix, create EVIDENCE TEST: fail before, pass after.

EIGHTH: Report verdict. Every layer must have an explicit answer.

--- Load references/review-checklist.md for the full checklist ---
```

## Gotchas

- **Fresh context is mandatory.** The review subagent MUST be a separate
  `hermes chat -q` process launched from the orchestrator. Never let the
  implementing agent review its own code.
- **CI gaming is checked FIRST.** Agents fail CI → remove tests, skip lint,
  lower coverage. Check `.github/workflows/` before reading any code.
- **Assumption violations are #1 missed bug class.** For every function,
  enumerate: what does it assume about inputs? timing? state? Then violate
  each assumption.
- **Cross-model review catches more.** Different model families have different
  blind spots. If possible: implement with Claude, review with Gemini.
- **The last 10% can't be caught here.** Cross-service interactions and
  scale-dependent failures need post-merge integration testing.

## References

- `references/review-checklist.md` — 4-layer adversarial checklist: assumption
  violation, composition failure, path enumeration, cascade construction.
  Loaded by review subagent during execution.
