---
name: simplify
description: >
  Code simplification that reduces complexity without changing behaviour.
  Two modes: Workflow (parallel subagents per worktree after execute) and
  Direct Changes (single subagent, scope + requirements provided by main
  agent). Three risk tiers: SAFE (auto-apply), CAREFUL (one-at-a-time,
  revert on failure), RISKY (flag only).
  LOAD when execute has completed (Workflow) or user asks to simplify /
  clean up / refactor / 簡化 a direct change.
  NOT for: unimplemented code, feature changes, behavioural modifications,
  or full-codebase refactors.
author: LaiTszKin
version: 0.3.0
metadata:
  jovaltus:
    tags: [simplify, cleanup, refactor, worktree, parallel, subagent, direct]
---

# Simplify

## Goal

Reduce code complexity without changing behaviour. Behaviour preservation is
inviolable: same output, same errors, same side effects, same ordering.

**Mode decision:** `.worktrees/` exists with implemented code → Workflow.
Single codebase, known changed files → Direct Changes.

Pipeline position (Workflow only): `execute` → **simplify** → `review` → `qa`

## Shared Principles

### Risk Tiers

| Tier | Strategy | Scope |
|------|----------|-------|
| **SAFE** | Apply all at once, verify once | Unused imports, dead code (git-blame confirmed), redundant comments, pass-through wrappers, unnecessary type casts |
| **CAREFUL** | One at a time, verify each, revert breakers | Flatten nesting → guard clauses, rename ambiguous locals, extract ≥2 duplicates, replace deep ternaries |
| **RISKY** | Never apply — document for review | Public API changes, concurrency, error handling, architectural abstractions |

Before removing: grep symbol usage + `git blame`. Unclear purpose → skip.

**Clarity over brevity.** Readable 10 lines beats incomprehensible 3.

### Simplification Categories

Use these to classify findings. Each maps to a risk tier.

| Category | What to look for | Tier |
|----------|-----------------|------|
| DEAD CODE | Unused imports, dead functions, commented-out blocks | SAFE |
| AI SLOP | Redundant comments, unnecessary null checks on validated inputs, type casts weakening the type system | SAFE / CAREFUL |
| CONTROL FLOW | Deep nesting (3+ levels), nested ternaries, boolean flags | CAREFUL |
| NAMING | Generic names (data, temp), inconsistent vocabulary | CAREFUL / RISKY |
| DUPLICATION | Near-duplicate blocks, repeated patterns (≥2 call sites) | CAREFUL |
| OVER-ENGINEERING | Single-use helpers, abstractions for futures that never arrived | CAREFUL / RISKY |

---

## Mode 1: Workflow (Pipeline)

Parallel subagents per worktree after `execute`. Each reads code, applies
simplifications, runs verification, reports.

### Acceptance Criteria

- Every worktree with executed code gets a subagent
- SAFE: bulk apply; CAREFUL: one-at-a-time with verify; RISKY: document only
- All verifications pass (breakers reverted)
- Report per worktree: changes, risk tier, test outcome

### Prerequisites

1. `.worktrees/<id>-<slug>/` with implemented code + `TASK.md` (verification command)
2. `hermes` CLI in PATH

### Workflow

**Phase 1 — Discover:** Find worktrees with `TASK.md` + verification command +
actual source files. Skip config/doc-only → report SKIPPED.

**Phase 2 — Dispatch:** Per worktree (3-5 concurrent):
```
terminal(
    command="hermes chat -q '<prompt>'",
    workdir=".worktrees/<id>-<slug>",
    background=true, notify_on_complete=true, timeout=1800
)
```

**Phase 3 — Collect:** `process(action='wait')` per session.
- 🟢 SIMPLIFIED: ≥1 SAFE/CAREFUL applied, verify passes
- 🟡 CLEAN: nothing to simplify
- 🔴 BLOCKED: verify failed (reverted) or RISKY-only

**Phase 4 — Report:** Summary table + RISKY findings with file:line, issue,
rationale, suggestion.

### Subagent Brief

```
You are a CODE SIMPLIFICATION specialist. Behaviour preservation is your #1 rule.

PHASE 1 — Understand:
- Read TASK.md and every source file. Run verification to establish baseline.
- git blame + grep before touching anything uncertain.

PHASE 2 — Identify (do NOT apply yet). Classify by risk tier:

SAFE — apply all at once, verify once: unused imports, dead code (git-blame
confirmed), redundant comments restating code, pass-through wrappers,
unnecessary type casts (# type: ignore / as any where types already cover).

CAREFUL — one at a time, verify each, revert breakers: flatten nesting with
guard clauses, rename ambiguous locals, extract helpers from ≥2 real
duplicates, replace deep ternaries with if/else, consolidate repeated patterns.

RISKY — NEVER apply, document only: public API renames, concurrency changes,
error-handling restructuring, architectural abstraction removal.

Scan systematically: dead code → AI slop → control flow → naming →
duplication → over-engineering.

PHASE 3 — Apply (strict order):
1. SAFE: all at once → verify → revert + re-classify on failure.
2. CAREFUL: one at a time → verify after each → revert breakers.
3. RISKY: document only.

PHASE 4 — Report:
## Simplify Report — <worktree-id>
| # | File:Line | Change | Risk | Rationale |
### RISKY Findings (Not Applied)
### Verification: <cmd> → before: ✅ / after: ✅
```

---

## Mode 2: Direct Changes

Single subagent for simple direct changes. Main agent provides scope +
requirements + plan. Subagent simplifies only the changed files.

### Prerequisites

Main agent gathers:
- **Change scope:** files modified + one-line description each
- **Original requirements:** user's request verbatim (detects scope creep)
- **Implementation plan:** what was built and why, trade-offs, constraints
- **Verification command:** exact command to run

### Workflow

**Phase 1 — Prepare context.** Gather the four items above.

**Phase 2 — Dispatch.** ONE subagent via `delegate_task` (preferred) or
`hermes chat -q`. Provide all four context items in the prompt.

**Phase 3 — Apply results.** Review subagent report: apply SAFE changes,
review CAREFUL one-by-one with verify, flag RISKY for user.

**Phase 4 — Report to user.** Summary table + RISKY findings + verification
before/after.

### Subagent Brief

```
You are a CODE SIMPLIFICATION specialist. Behaviour preservation is your #1 rule.

CONTEXT (from orchestrator):
- Change scope: exact files modified
- Original user requirements: verbatim — use as benchmark for what code SHOULD do
- Implementation plan: what was built and why
- Verification command: how to confirm nothing broke

PHASE 1 — Understand:
- Read every file in change scope. Cross-reference against original requirements
  — anything beyond them may be scope creep or over-engineering.
- Run verification to establish baseline.
- git blame + grep before touching anything uncertain.

PHASE 2 — Identify (do NOT apply yet). Classify by risk tier:

SAFE — apply all at once, verify once: unused imports, dead code (git-blame
confirmed), redundant comments restating code, pass-through wrappers,
unnecessary type casts (# type: ignore / as any where types already cover).

CAREFUL — one at a time, verify each, revert breakers: flatten nesting with
guard clauses, rename ambiguous locals, extract helpers from ≥2 real
duplicates, replace deep ternaries with if/else, consolidate repeated patterns.

RISKY — NEVER apply, document only: public API renames, concurrency changes,
error-handling restructuring, architectural abstraction removal.

Scan systematically against the original requirements:
- DEAD CODE → SAFE (unused imports, dead functions, commented-out blocks)
- AI SLOP → SAFE/CAREFUL (redundant comments, unnecessary null checks, weak casts)
- CONTROL FLOW → CAREFUL (deep nesting, nested ternaries, boolean flags)
- NAMING → CAREFUL/RISKY (generic names, inconsistent vocabulary)
- DUPLICATION → CAREFUL (near-duplicate blocks, ≥2 call sites)
- OVER-ENGINEERING → CAREFUL/RISKY (single-use helpers, future-proof abstractions
  — cross-reference: did the requirement ask for this?)

PHASE 3 — Apply:
1. SAFE: all at once → verify → revert + re-classify on failure.
2. CAREFUL: one at a time → verify after each → revert breakers.
3. RISKY: document only.

SCOPE: Touch ONLY files in the change scope. Note unrelated issues but don't fix.

PHASE 4 — Report:
## Simplify Report — Direct Changes
### Changes Applied
| # | File:Line | Change | Risk | Rationale |
### RISKY Findings (Not Applied)
### Verification: <cmd> → before: ✅ / after: ✅
```

---

## Gotchas

- **Chesterton's Fence.** Unused-looking code may be reached dynamically
  (reflection, metaprogramming). Always grep + git blame before removing.
- **This is NOT review.** Simplify improves form; review verifies behaviour.
- **Verification command from context, not assumptions.** Never assume
  `pytest` or `npm test`.

### Workflow Mode

- **Parallel dispatch is safe.** Worktrees have disjoint file ownership.
- **Skip empty worktrees.** Config/doc-only → SKIPPED, not failure.
- **Concurrency: 3-5.** More risks API rate limits + disk contention.
- **Timeout (1800s).** Non-zero exit → 🔴 BLOCKED.

### Direct Changes Mode

- **Scope discipline.** Only touch files in change scope.
- **Requirements as benchmark.** Anything beyond the original request is suspect.
- **Single subagent only.** Multi-area changes → consider Workflow mode.
- **Provide raw requirements verbatim.** No summary or reinterpretation.
