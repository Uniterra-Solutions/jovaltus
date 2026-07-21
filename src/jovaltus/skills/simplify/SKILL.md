---
name: simplify
description: >
  Dispatches simplification subagents into all executed worktrees in parallel.
  Each subagent reads the code, applies risk-tiered simplifications (SAFE →
  CAREFUL → RISKY), and verifies tests still pass. Behaviour preservation is
  the inviolable rule — only HOW code is expressed changes, never WHAT it
  does. Runs after execute, before review, using the same worktree-isolated
  terminal dispatch pattern.
  LOAD when:
  - execute has completed and all worktrees have implemented code
  - User says "simplify" or "clean up" or "refactor" or "簡化"
  - Ready to reduce complexity before adversarial review
  Do NOT use for:
  - Code that hasn't been implemented yet
  - Feature changes or behavioural modifications
  - Full-codebase refactors (scope is per-worktree, post-execute only)
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [simplify, cleanup, refactor, worktree, parallel, subagent]
---

# Simplify

## Goal

Spawn one simplification subagent per worktree in parallel. Each subagent
reads the implemented code, applies simplifications that reduce complexity
without changing behaviour, runs the verification command, and reports
what changed. Code that was correct but messy becomes correct and clean.

Position in pipeline: `execute` → **simplify** → `review` → `qa`

## Acceptance Criteria

- Every worktree with executed code gets a simplification subagent
- All subagents run in parallel via `terminal(background=true, workdir=<path>)`
- Three risk tiers applied: SAFE (auto), CAREFUL (verify), RISKY (flag only)
- Every simplification preserves the verification command's exit code
- Simplified code is reportable: what changed, why, risk tier, test result
- No behavioural changes — all inputs, outputs, side effects, and error
  behaviour remain identical

## Core Principles

**Behaviour preservation is inviolable.** Change HOW code is expressed, never
WHAT it does. Every simplification must pass: "Does this produce the same
output for every input? Same error behaviour? Same side effects and ordering?"

**Chesterton's Fence.** Before removing any code, understand why it exists.
Run `git blame` on the line. If the original purpose is unclear, flag as
`confidence: low` — don't guess and don't remove.

**Risk-tiered simplification.** Not all changes are equal:
- **SAFE** — proven not to affect behaviour (unused imports, dead code
  confirmed via git blame, redundant comments restating obvious code,
  pass-through wrappers). Auto-apply immediately.
- **CAREFUL** — improves without changing semantics (flatten nested
  conditionals with guard clauses, rename ambiguous locals, extract helper
  from duplication, consolidate repeated patterns). Apply one at a time,
  run tests after each. Revert any that break.
- **RISKY** — may affect behaviour or public contracts (public API renames,
  concurrency restructuring, error-handling changes, N+1 refactors). DO NOT
  apply. Flag for human review with evidence.

**Clarity over brevity.** The goal is code a new team member understands
faster — not fewer lines. Prefer explicit over clever. A readable 10-line
function beats an incomprehensible 3-line one-liner.

**Scope is the worktree.** Only touch files in this worktree. The parallel
dispatch guarantees disjoint file ownership — there is zero risk of merge
conflicts from simplification across worktrees.

## Prerequisites

1. Worktrees at `.worktrees/<id>-<slug>/` with implemented code from `execute`
2. Each worktree has `TASK.md` with a verification command
3. `hermes` CLI in PATH

## Workflow

### Phase 1: Verify Worktrees Exist

List worktrees: search `.worktrees/` for directories containing `TASK.md`.
Confirm each has implemented code (not empty stub files). Skip any worktree
that has no code to simplify — report it as SKIPPED.

### Phase 2: Dispatch Simplification Subagents

For every worktree simultaneously:

```
terminal(
    command="hermes chat -q '<simplify-subagent-prompt>'",
    workdir=".worktrees/<id>-<slug>",
    background=true,
    notify_on_complete=true,
    timeout=1800
)
```

Collect session_id per task. Mark all 🟡 running.

### Phase 3: Collect Results

For each process: `process(action='wait', session_id=<id>)`. Parse the
subagent's final reply for the structured report. Classify outcome:

- 🟢 **SIMPLIFIED**: at least one SAFE or CAREFUL change applied; verification passes
- 🟡 **CLEAN**: no simplifications found (code already clean)
- 🔴 **BLOCKED**: verification failed after a change (reverted), or RISKY-only
  findings that require human decision

### Phase 4: Report

Summary table:

| Worktree | Status | SAFE | CAREFUL | RISKY flagged | Verification |
|----------|--------|------|---------|---------------|--------------|
| t1-auth  | SIMPLIFIED | 3 | 2 | 1 | ✅ pass |
| t2-api   | CLEAN | 0 | 0 | 0 | ✅ pass |
| t3-utils | BLOCKED | 1 | 0 | 2 | ❌ reverted |

For RISKY findings: present each with file:line, the issue, why it's risky,
and a concrete suggestion. User decides which to apply.

## Simplification Subagent Prompt

Injected into each subagent:

```
You are a CODE SIMPLIFICATION specialist. Your job: make the code in this
worktree cleaner without changing what it does — at all. Behaviour
preservation is your #1 rule. Violate it and your work is rejected.

PHASE 1 — UNDERSTAND:
- Read TASK.md. Know what this code is supposed to do.
- Read every source file. Run the verification command to establish baseline.
- For any code you're unsure about, run `git blame` on the line. Understand
  why it exists before touching it.

PHASE 2 — IDENTIFY (do NOT apply yet):
Work through this checklist. For each finding, classify risk tier:

A. DEAD CODE:
   - Unused imports, variables, functions (grep for the symbol name first —
     dynamic usage won't show up in static analysis).
   - Commented-out code blocks.
   - Pass-through functions that only call another function with the same args.
   → Risk: SAFE

B. AI SLOP:
   - Comments that restate obvious code (e.g. "# increment counter" above
     "count++").
   - Unnecessary defensive null-checks on already-validated inputs.
   - Type casts that bypass the type system (e.g. `as any` in TS, `# type: ignore`
     in Python).
   - Patterns inconsistent with the rest of the file/project.
   → Risk: SAFE (removing comments, casts where safe) / CAREFUL (structural)

C. CONTROL FLOW:
   - Deep nesting (3+ levels). Flatten with guard clauses, early returns.
   - Nested ternaries. Replace with if/else or lookup tables.
   - Boolean parameter flags. Consider separate functions or options objects.
   → Risk: CAREFUL

D. NAMING:
   - Generic names (data, temp, result, item). Replace with intention-revealing
     names when scope is local and rename is safe.
   - Inconsistent vocabulary (e.g. "remove" in one place, "delete" in another
     for the same concept).
   → Risk: CAREFUL (local renames) / RISKY (public API renames → FLAG ONLY)

E. DUPLICATION:
   - Near-duplicate blocks (copy-paste with minor variations). Extract when
     Rule of Three applies (≥2 real call sites benefit, abstraction reduces
     cognitive load).
   - Repeated patterns that a shared helper or constant could replace.
   → Risk: CAREFUL

F. OVER-ENGINEERING:
   - Single-use helper functions that don't earn their complexity.
   - Abstractions that exist for a future that never arrived.
   - Overly generic code where a direct approach is clearer.
   → Risk: CAREFUL (inlining single-use helpers) / RISKY (architectural)

PHASE 3 — APPLY (in strict risk order):

1. SAFE changes first. Apply all at once. Run verification. If it fails,
   revert and investigate — something you classified SAFE wasn't.
2. CAREFUL changes next. Apply ONE at a time. Run verification after EACH.
   If a change breaks tests, revert it immediately and skip it.
3. RISKY changes: DO NOT APPLY. Document them for human review.

PHASE 4 — REPORT:

Output this exact structure as your final reply:

## Simplify Report — <worktree-id>

### Changes Applied
| # | File:Line | Change | Risk | Rationale |
|---|-----------|--------|------|-----------|
| 1 | src/x.py:42 | Removed unused import `os` | SAFE | grep confirms no usage |
| 2 | src/x.py:58 | Flattened nested if → guard clause | CAREFUL | Same behaviour, 2 fewer indent levels |
| ... | ... | ... | ... | ... |

### RISKY Findings (Not Applied)
| # | File:Line | Issue | Suggested Fix | Why RISKY |
|---|-----------|-------|---------------|-----------|
| 1 | src/api.py:30 | Public function `get_user` could be renamed | Rename to `fetch_user_by_id` | Public API — consumers may depend on name |
| ... | ... | ... | ... | ... |

### Verification
- Command: <verification-command>
- Before: ✅ pass
- After: ✅ pass / ❌ fail (reverted N changes)
```

## Gotchas

- **Subagent must not change behaviour.** This is the one rule that cannot
  bend. If verification fails after any change, revert immediately. The code
  was correct before — correctness beats cleanliness.
- **Chesterton's Fence applies everywhere.** Unused-looking code may be used
  dynamically (reflection, string-based imports, metaprogramming). Always grep
  for the symbol name before removing. `git blame` reveals original intent.
- **Don't over-simplify.** Inlining every helper creates god functions.
  Removing every abstraction destroys testability. Simplification is about
  making code easier to understand — not shorter.
- **Risk-tier discipline is critical.** SAFE and CAREFUL have different
  application strategies. Applying CAREFUL changes in bulk (instead of one
  at a time) makes it impossible to know which one broke the build.
- **Parallel dispatch is safe by construction.** Worktrees have disjoint file
  ownership. Two simplification subagents cannot conflict because they
  operate on different files. No coordination needed.
- **Verification command per worktree.** Each TASK.md specifies its own
  verification command. The subagent must use that exact command — don't
  assume `pytest` or `npm test`.
- **Skip empty worktrees.** If a worktree has no implemented code (e.g. a
  config-only task), the simplify subagent has nothing to do. Report it
  as SKIPPED, not as a failure.
- **Concurrency sweet spot is 3-5.** Same as `execute`. More than 5 risks
  API rate limits and disk I/O contention.
- **This is NOT review.** Simplify improves code form; review verifies code
  function. They are complementary — simplify makes review more effective
  by removing noise (dead code, slop) so the reviewer focuses on real issues.
