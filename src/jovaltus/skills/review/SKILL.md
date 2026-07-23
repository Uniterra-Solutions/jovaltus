---
name: review
description: >
  Adversarial code review that tries to BREAK code through assumption
  violation, path enumeration, and cascade construction. Two modes:
  Workflow (parallel subagents per worktree after simplify, with merge +
  cleanup) and Direct Changes (single subagent, scope + requirements
  provided by main agent). Every fix demands an evidence test. Depth
  calibrated by risk.
  Use when: review, code review, 審核, 代碼審查, 檢查代碼, post-implementation
  quality gate.
  NOT for: unimplemented code, casual checklist reviews, merge conflict
  resolution, pre-implementation design review.
author: LaiTszKin
version: 0.5.0
metadata:
  jovaltus:
    tags: [review, adversarial, code-review, quality, merge, cleanup, direct]
---

# Review

## Goal

Adversarially try to BREAK code — violate assumptions, construct failure
cascades, walk every path. Only code that survives gets merged (Workflow)
or passed (Direct Changes). Every fix demands an evidence test: must fail
before the fix, pass after.

**Mode decision:** `.worktrees/` exists with simplified code → Workflow.
Single codebase, known changed files → Direct Changes.

Pipeline position (Workflow only): `execute` → `simplify` → **review** → `qa`

## Shared Principles

### Adversarial Mindset

"How does this FAIL?" not "Does this follow best practices?" Enumerate
assumptions about inputs, timing, state, and environment — then violate
each systematically. CI gaming is checked FIRST (scan CI configs for removed
tests, skipped lint, lowered coverage).

### Depth by Risk

| Risk Signal | Depth | Layers | Time |
|---|---|---|---|
| auth, payment, crypto, PII, session, webhook, migration | DEEP | 1-4 | 15-20 min |
| CRUD, business logic, data processing | STANDARD | 1-3 | 8-12 min |
| utility, config, docs, test-only, refactor (no logic change) | QUICK | 1-2 | 3-5 min |

### Fresh Context + Evidence Tests

Review subagent = clean session. Same agent reviewing own code = rubber stamp.
Every fix → evidence test named after the bug (`test_returns_400_on_null_email`).

---

## Mode 1: Workflow (Pipeline)

Parallel adversarial subagents per worktree after `simplify`. Code that
survives gets merged; worktrees cleaned up after.

### Acceptance Criteria

- Every task gets a subagent with fresh context, calibrated depth
- Every fix has evidence test (fail before, pass after)
- CI gaming detected → 🔴 BLOCKED
- All ✅ → merge + cleanup; any ❌ → report to user

### Prerequisites

1. `.worktrees/<id>-<slug>/` with simplified code + `TASK.md`
2. `hermes` CLI in PATH
3. `references/review-checklist.md` available

### Workflow

**Phase 1 — Merge target:** Identify + confirm with user.

**Phase 2 — Calibrate:** Per TASK.md, classify each worktree DEEP / STANDARD / QUICK.

**Phase 3 — Dispatch:** Per worktree simultaneously:
```bash
CHECKLIST=$(cat references/review-checklist.md)
hermes chat -q "You are an ADVERSARIAL CODE REVIEWER. Read TASK.md, then
try to BREAK the code using the embedded checklist. Depth: <DEPTH>.
--- FULL CHECKLIST ---
$CHECKLIST
--- END CHECKLIST ---"
```
Launch: `background=true`, `notify_on_complete=true`, `timeout=1800`, `workdir=.worktrees/<id>-<slug>`.

**Phase 4 — Collect:** Wait all. All ✅ → merge. Any ❌ → report blocked.
⚠️ FIXED → re-verify evidence tests.

**Phase 5 — Merge + cleanup (all passed):** Follow `references/flat-parallel-merge.md`:
1. Commit worktree changes
2. Merge T01 first (owns infra files)
3. Merge rest; `--ours` for foundation files
4. Resolve task-owned conflicts via manifest
5. Fix config/contract mismatches; full test suite
6. `git worktree remove --force`, prune, delete branches

---

## Mode 2: Direct Changes

Single adversarial subagent for simple direct changes. Main agent provides
scope + requirements + plan. Subagent tries to BREAK only the changed files.

### Prerequisites

Main agent gathers:
- **Change scope:** files modified + one-line description each
- **Original requirements:** user's request verbatim
- **Implementation plan:** what was built, decided, and why
- **Verification command:** exact command to run

### Workflow

**Phase 1 — Prepare context.** Gather the four items above.

**Phase 2 — Calibrate depth.** One review, one depth — use the highest risk
signal in the change scope (auth/crypto → DEEP, CRUD → STANDARD, etc.).

**Phase 3 — Dispatch.** ONE subagent via `delegate_task` (preferred) or
`hermes chat -q`. Embed the 4-layer checklist + all context items.

**Phase 4 — Collect verdict.** Review subagent result: apply unreviewed fixes,
re-verify, escalate ❌ BLOCKED to user.

**Phase 5 — Report.** Verdict + issues table + evidence tests + verification
before/after. No merge/cleanup needed (changes already in working tree).

### Subagent Brief

```
You are an ADVERSARIAL CODE REVIEWER. Your job is to BREAK the code.

CONTEXT (from orchestrator):
- Change scope: exact files modified
- Original user requirements: verbatim — validate implementation matches intent
- Implementation plan: what was built and why
- Verification command: how to confirm nothing broke
- Depth: <DEEP|STANDARD|QUICK>

PRE-REVIEW (do FIRST):
1. CI GAMING: scan CI configs. Removed tests? Skipped lint? Lowered coverage?
   If YES → 🔴 BLOCKED.
2. SCOPE CREEP: changed files NOT in change scope? Revert or flag.

METHOD — 4-Layer Adversarial Review:

LAYER 1 — Assumption Violation:
For every function, violate assumptions about:
- Data: null, empty, missing fields, wrong type, unicode, max length,
  boundary values (INT_MAX, 0, -1, NaN), duplicates, injection
- Timing: operation order, timeout, TOCTOU (deleted between check and use),
  concurrent access, clock skew
- Values: positive-only, finite, valid enum, monotonic
- Environment: config missing, network down, disk full, permissions denied
For each: construct the violating input, trace through, report result.

LAYER 2 — Composition Failures:
- Contract mismatches: caller↔callee value/return/error type mismatches
- Shared state: read-after-write races, write-after-write, cache invalidation,
  transaction boundaries
- Ordering: init before use? cleanup after last use? callback before setup?
- Error propagation: swallowing, info loss, retry storms, partial failure state

LAYER 3 — Path & Edge Enumeration (DEEP + STANDARD):
- Branches: all reachable? default fallback? correct conditions? all 2^N combos?
  implicit branches (unhandled enum values)?
- Loops: empty, single element, large input, off-by-one, infinite, mutated during
- Error paths: reachable? info preserved? resources cleaned up? handler fails?
- State: all valid transitions, every invalid rejected, concurrent, stale data

LAYER 4 — Cascade Construction (DEEP only):
- Resource exhaustion: connection pool, memory, fd, retry amplification
- State corruption: partial write → bad read → bad decision → cascading error
- Recovery failures: retry creates duplicate, rollback deletes new data,
  health check cascade (all instances removed)
- Cross-component: downstream timeout → retry storm, cache stampede

FOR EVERY ISSUE:
1. Construct the specific input/scenario that triggers failure.
2. Apply the minimal fix.
3. Write an evidence test: FAILS before fix, PASSES after.
   Name after the bug: test_returns_400_when_email_is_null.
4. Re-run the full verification command.

SCOPE: Touch ONLY files in the change scope. Note unrelated issues, don't fix.

REPORT:
### Review Verdict: ✅ PASS / ⚠️ FIXED / ❌ BLOCKED
### Depth Applied
### Issues Found & Fixed
- [Layer] description → fix → evidence test name
### Evidence Tests Created
### Unresolved Issues
### Final Verification
```

---

## Gotchas

- **Subagent must be separate process.** Same agent reviewing own code = blind.
- **CI gaming FIRST.** Before reading code, scan configs for tampering.
- **Assumption violations are #1 missed bug class.** Enumerate and violate.
- **Cross-model review catches more.** Different families = different blind spots.
- **Checklist must be in subagent prompt.** Subagents can't read orchestrator files.
  Pipe via `cat` or inline verbatim.

### Workflow Mode

- **Merge T01 first.** It owns infra files. Wrong order = cascading conflicts.
- **Never delete worktrees before merge confirmed.**
- **Per-task depth calibration.** Mixed task sets get per-task depth, not global.
- **Timeout (1800s).** Non-zero exit → ❌ BLOCKED.

### Direct Changes Mode

- **Scope discipline.** Only review files in change scope.
- **Requirements as benchmark.** Implementation beyond original request = scope creep.
- **Single subagent only.** Multi-area with different risk profiles → Workflow.
- **No merge/cleanup.** Changes already in working tree.
- **Provide raw requirements verbatim.** No summary or reinterpretation.

## References

- `references/review-checklist.md` — 4-layer adversarial checklist. Embedded
  verbatim into Workflow subagent prompts via `cat`.
- `references/flat-parallel-merge.md` — Merge resolution + worktree cleanup
  pattern. Used in Workflow Phase 5.
