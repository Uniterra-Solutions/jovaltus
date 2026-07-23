---
name: review
description: >
  Adversarial code review that tries to BREAK code, not just check it.
  Exhaustive assumption violation, path enumeration, and cascade
  construction calibrated by risk (auth/payment → deep, CRUD → standard).
  Every fix demands an evidence test. Merges branches and cleans up
  worktrees after all reviews pass.
  Use when: review, code review, 審核, 代碼審查, 檢查代碼, adversarial review,
  post-implementation quality gate.
  NOT for: code that hasn't been implemented yet, casual checklist reviews,
  merge conflict resolution, or pre-implementation design review.
author: LaiTszKin
version: 0.4.0
metadata:
  jovaltus:
    tags: [review, adversarial, code-review, quality, merge, cleanup]
---

# Review

## Goal

Spawn adversarial review subagents per worktree. Each subagent tries to
BREAK the code through exhaustive enumeration — violating assumptions,
constructing failure cascades, walking every code path. Only code that
survives gets merged. Worktrees are cleaned up after merge.

## Acceptance Criteria

- Every manifest task gets an adversarial review subagent with fresh context
- Depth calibrated by risk: DEEP (auth/payment/crypto) → 4 layers;
  STANDARD (CRUD) → 3 layers; QUICK (utility) → 2 layers
- Every fix has an evidence test (fails before fix, passes after)
- CI gaming detected and rejected
- ✅ passed → merged + worktrees cleaned up
- ❌ blocked → reported to user with unresolved issues

## Core Principles

**Adversarial, not checklist.** "Does this follow best practices?" catches
~13% of bugs. "How does this FAIL?" with exhaustive enumeration catches
90%+. The reviewer is a chaos engineer, not a quality auditor.

**Fresh context is load-bearing.** Review subagent = clean `hermes chat -q`
session with no implementation memory. Same agent reviewing its own code =
expensive rubber stamp.

**Depth by risk, not diff size.** A 5-line auth change gets deep cascade
analysis. A 200-line CRUD endpoint gets standard review.

**Evidence test = proof of fix.** "Added null check" is a claim.
`test_returns_400_on_null_input` failing before and passing after is proof.

## Workflow

### Phase 1: Determine Merge Target

Identify the target branch for merging. Confirm with user.

### Phase 2: Calibrate Depth Per Task

For each task's TASK.md, classify risk:

| Risk Signal | Depth | Layers | Expected duration |
|---|---|---|---|
| auth, payment, crypto, PII, session, webhook, migration | DEEP | 1-4 | 15-20 min |
| CRUD, business logic, data processing | STANDARD | 1-3 | 8-12 min |
| utility, config, docs, test-only | QUICK | 1-2 | 3-5 min |

### Phase 3: Spawn Adversarial Reviews

For every task simultaneously, launch a subagent with the adversarial review
checklist embedded directly in the prompt (the subagent has no access to
reference files — inline everything it needs):

```bash
# Build the self-contained prompt
CHECKLIST=$(cat references/review-checklist.md)
PROMPT="You are an ADVERSARIAL CODE REVIEWER. Read TASK.md, then try to
BREAK the code using the checklist below. For every issue found: fix it,
add an evidence test, re-verify. Report verdict with explicit layer-by-layer
answers. Depth: <DEPTH>.

--- FULL CHECKLIST ---
$CHECKLIST
--- END CHECKLIST ---"

# Launch subagent in worktree
hermes chat -q "$PROMPT"
```

Launch parameters:
- `workdir`: `.worktrees/<id>-<slug>`
- `background=true`, `notify_on_complete=true`
- `timeout=1800`

### Phase 4: Collect Verdicts

Wait all subagents. Decision matrix:
- **All ✅** → proceed to merge + cleanup
- **Any ❌** → report blocked tasks with unresolved issues; user decides
- **⚠️ FIXED, no ❌** → re-verify evidence tests; failures → treat as ❌

### Phase 5: Merge + Cleanup (All Passed)

Follow the pattern in `references/flat-parallel-merge.md`:

1. Commit worktree changes (subagents edit but don't commit)
2. Merge foundation task (T01) first — it owns `pyproject.toml`, `config.py`,
   `utils/*`, `__init__.py`
3. Merge remaining tasks; accept `--ours` for foundation files
4. Resolve task-owned file conflicts via manifest lookup
5. Fix config/contract mismatches; run full test suite
6. Remove worktrees (`git worktree remove --force`), prune, delete branches

## Gotchas

- **Review subagent must be a separate `hermes chat -q` process.** The
  implementing agent reviewing its own code catches nothing.
- **CI gaming is checked FIRST.** Agents fail CI → remove tests, skip lint,
  lower coverage thresholds. Check configs before reading any code.
- **Assumption violations are #1 missed bug class.** For every function,
  enumerate what it assumes about inputs, timing, and state — then violate
  each assumption.
- **Cross-model review catches more.** Different model families have different
  blind spots. If possible: implement with Claude, review with Gemini.
- **Merge foundation task (T01) first.** It owns infrastructure files.
  Wrong merge order = cascading conflicts.
- **The review checklist MUST be embedded in the subagent prompt.** Subagents
  cannot access the orchestrator's reference files. Use `cat
  references/review-checklist.md` to inline it.
- **Never delete worktrees before merging.** Worktrees contain the committed
  code. Use `--force` only after merge is confirmed.

## References

- `references/review-checklist.md` — 4-layer adversarial checklist (assumption
  violation, composition failure, path enumeration, cascade construction).
  Embedded verbatim into every review subagent prompt.
- `references/flat-parallel-merge.md` — 7-step merge resolution and worktree
  cleanup pattern. Used in Phase 5 after all reviews pass.
