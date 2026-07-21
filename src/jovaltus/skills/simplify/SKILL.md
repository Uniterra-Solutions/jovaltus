---
name: simplify
description: >
  Parallel simplification subagents per worktree after execute completes.
  Three risk tiers: SAFE (auto-apply), CAREFUL (one-at-a-time, revert on
  failure), RISKY (flag only). Behaviour preservation is inviolable.
  LOAD when:
  - execute has completed and worktrees have implemented code
  - User says "simplify", "clean up", "refactor", or "簡化"
  Do NOT use for:
  - Code that hasn't been implemented yet
  - Feature changes or behavioural modifications
  - Full-codebase refactors (scope is per-worktree, post-execute only)
author: LaiTszKin
version: 0.2.0
metadata:
  jovaltus:
    tags: [simplify, cleanup, refactor, worktree, parallel, subagent]
---

# Simplify

## Goal

Spawn one simplification subagent per worktree in parallel. Each reads the
code, applies simplifications that reduce complexity without changing
behaviour, runs the verification command, and reports what changed.

Pipeline position: `execute` → **simplify** → `review` → `qa`

## Acceptance Criteria

- Every worktree with executed code gets a simplification subagent
- SAFE changes apply in bulk; CAREFUL one-at-a-time with verification after each
- RISKY findings are documented but never applied — human decides
- All verifications pass after simplification (any breaking change is reverted)
- Report per worktree: what changed, why, risk tier, test outcome

## Risk Tiers

Behaviour preservation is inviolable. Every change must survive: "Same output
for every input? Same error behaviour? Same side effects and ordering?"

| Tier | Strategy | What to simplify | Examples |
|------|----------|-----------------|----------|
| **SAFE** | Apply all at once; verify once | Proven not to affect behaviour | Unused imports, dead code (git-blame confirmed), comments restating obvious code, pass-through wrappers, unnecessary `# type: ignore` / `as any` casts where type system already covers |
| **CAREFUL** | Apply one-at-a-time; verify after each; revert any that break | Improves clarity without changing semantics | Flatten nested conditionals with guard clauses, rename ambiguous locals, extract helper from ≥2 real duplicates, consolidate repeated patterns, replace deep ternaries with if/else |
| **RISKY** | **Do not apply.** Document with evidence for human review. | May affect behaviour or public contracts | Public API renames, concurrency restructuring, error-handling changes, architectural abstractions (single-use helpers, "future-proof" layers) |

Before removing anything: grep for the symbol name (dynamic usage won't show
in static analysis). Run `git blame` on the line. If the original purpose is
unclear, flag as `confidence: low` and skip — don't guess.

**Clarity over brevity.** A readable 10-line function beats an incomprehensible
3-line one-liner. The goal is faster comprehension for the next developer, not
fewer characters.

## Prerequisites

1. Worktrees at `.worktrees/<id>-<slug>/` with implemented code from `execute`
2. Each worktree has `TASK.md` with a verification command
3. `hermes` CLI in PATH

## Workflow

### Phase 1: Discover Worktrees

Find all directories under `.worktrees/` containing `TASK.md` with a
verification command and source files that contain actual implementation
code. Skip config-only or doc-only worktrees — report SKIPPED.

### Phase 2: Dispatch Subagents

For every worktree simultaneously (3-5 concurrent sweet spot):

```
terminal(
    command="hermes chat -q '<simplification-prompt>'",
    workdir=".worktrees/<id>-<slug>",
    background=true,
    notify_on_complete=true,
    timeout=1800
)
```

### Phase 3: Collect Results

`process(action='wait')` per session_id. Classify outcome:

- 🟢 **SIMPLIFIED**: ≥1 SAFE or CAREFUL change applied; verification passes
- 🟡 **CLEAN**: no simplifications found (code already clean)
- 🔴 **BLOCKED**: verification failed (reverted), or RISKY-only findings

### Phase 4: Report

Summary table:

| Worktree | Status | SAFE | CAREFUL | RISKY flagged | Verification |
|----------|--------|------|---------|---------------|--------------|
| t1-auth  | SIMPLIFIED | 3 | 2 | 1 | ✅ pass |
| t2-api   | CLEAN | 0 | 0 | 0 | ✅ pass |
| t3-utils | BLOCKED | 1 | 0 | 2 | ❌ reverted |

For RISKY findings: present each with file:line, issue, why risky, and
concrete suggestion.

## Subagent Brief

The orchestrator injects this into each subagent's `hermes chat -q` prompt:

```
You are a CODE SIMPLIFICATION specialist. Your job: make the code cleaner
without changing what it does. Behaviour preservation is your #1 rule.

PHASE 1 — Understand:
- Read TASK.md and every source file.
- Run the verification command to establish baseline.
- For any code you're unsure about: git blame first, grep for symbol usage.

PHASE 2 — Identify (do NOT apply yet):
Classify every finding into one of three risk tiers:

SAFE — proven not to affect behaviour. Examples: unused imports, dead code
(git-blame confirmed), redundant comments, pass-through wrappers, unnecessary
type casts. STRATEGY: apply all at once, verify once.

CAREFUL — improves clarity without changing semantics. Examples: flatten
nested conditions with guard clauses, rename ambiguous locals, extract helper
from ≥2 duplicates, replace deep ternaries with if/else. STRATEGY: apply ONE
at a time, verify after each, revert any that break.

RISKY — may affect behaviour or public contracts. Examples: public API renames,
concurrency restructuring, error-handling changes, architectural abstraction
removal. STRATEGY: DO NOT APPLY — document for human review only.

Work through these categories:

DEAD CODE: unused imports, variables, functions (grep first), commented-out
blocks, pass-through functions that only delegate. → SAFE

AI SLOP: redundant comments, unnecessary null-checks on validated inputs,
type casts that weaken the type system, patterns inconsistent with the
rest of the project. → SAFE (removals) / CAREFUL (structural)

CONTROL FLOW: deep nesting (3+ levels → guard clauses), nested ternaries
(→ if/else), boolean flags (→ separate functions). → CAREFUL

NAMING: generic names (data, temp, result → intention-revealing), inconsistent
vocabulary (remove vs delete for same concept). → CAREFUL (locals) / RISKY (public)

DUPLICATION: near-duplicate blocks (Rule of Three: ≥2 call sites benefit),
repeated patterns. → CAREFUL

OVER-ENGINEERING: single-use helpers, abstractions for futures that never
arrived, overly generic code. → CAREFUL (inline) / RISKY (architectural)

PHASE 3 — Apply (strict risk order):
1. SAFE: apply all at once → verify → if fail, revert and re-classify.
2. CAREFUL: apply ONE at a time → verify after each → revert any that break.
3. RISKY: DO NOT APPLY. Document for human review only.

PHASE 4 — Report:
## Simplify Report — <worktree-id>

| # | File:Line | Change | Risk | Rationale |
|---|-----------|--------|------|-----------|

| 1 | src/x.py:42 | Removed unused import `os` | SAFE | grep: no usage |

### RISKY Findings (Not Applied)
| # | File:Line | Issue | Suggested Fix | Why RISKY |
|---|-----------|-------|---------------|-----------|

### Verification: <command> → before: ✅ / after: ✅
```

## Gotchas

- **Parallel dispatch is safe by construction.** Worktrees have disjoint file
  ownership — two simplification subagents cannot conflict.
- **Verification command is per-worktree.** Each TASK.md specifies its own
  command. Never assume `pytest` or `npm test`.
- **Chesterton's Fence.** Unused-looking code may be reached dynamically
  (reflection, string imports, metaprogramming). Always grep + git blame before
  removing.
- **Skip empty worktrees.** Config-only or doc tasks have nothing to simplify.
  Report SKIPPED, not failure.
- **Concurrency sweet spot: 3-5.** More risks API rate limits and disk I/O
  contention.
- **Timeout handling.** Subagent timeout (1800s) produces non-zero exit.
  Classify as 🔴 BLOCKED — the subagent didn't finish. Consider re-dispatching
  with a narrower scope or longer timeout.
- **This is NOT review.** Simplify improves code form; review verifies behaviour.
  They're complementary — simplify removes noise so review can focus on real issues.
