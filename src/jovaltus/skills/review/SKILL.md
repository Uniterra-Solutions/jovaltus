---
name: review
description: >
  Exhaustive worktree code review via subagent. Spawns a review subagent
  inside each worktree with a structured checklist covering conditional
  branches, edge cases, error handling, security, spec compliance, and
  contract adherence. Reviews methodically — every check category must
  be answered before the subagent reports completion. Fixes issues
  immediately in the worktree, re-verifies, then the orchestrator merges
  the worktree branch and cleans up.
  LOAD when:
  - execute has completed (all worktrees have implemented code)
  - User says "review" or "code review" or "審核" or "check the work"
  - Ready to gate worktree code before merging
  Do NOT use for:
  - Reviewing code that hasn't been implemented yet
  - Casual code review without structured checklist
  - Merge conflict resolution (that's post-review integration)
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [review, code-review, quality, gate, checklist, merge, cleanup]
---

# Review

## Goal

For every completed worktree, spawn a review subagent that exhaustively
audits the code against the task spec. The review covers every category:
edge cases, conditional branches, error handling, security, contract
adherence, test coverage. Issues found are fixed immediately in the
worktree. Only after all checks pass does the orchestrator merge the
branch and clean up the worktree.

## Acceptance Criteria

- Every task from the manifest has a review subagent spawned in its worktree
- Every review subagent follows the structured review checklist — no category
  is skipped
- All review categories receive explicit answers (✅ / ⚠️ with fix / ❌ blocker)
- Issues found are fixed in the worktree and re-verified before reporting done
- After review passes, the orchestrator merges the worktree branch into the
  original working branch and removes the worktree
- Failed reviews (unfixable issues) are reported; the user decides whether
  to merge anyway or re-work the task

## Core Principles

**Review in the worktree, not from outside.** The review subagent runs
inside the worktree so it can read code, run tests, apply fixes, and
re-verify — all within the isolation boundary.

**Checklist, not ad-hoc.** Every review subagent follows a structured
checklist (`assets/review-checklist.md`). The checklist enumerates every
category. The subagent must answer each category explicitly before
reporting completion. This prevents "looks good to me" reviews that
miss obvious issues.

**Fix immediately, don't file issues.** The review subagent has write
access to the worktree. When it finds a problem, it fixes it. If the
fix is non-trivial, it notes what changed. The goal is code ready to
merge, not a list of things to fix later.

**Merge gate, not merge automation.** The orchestrator merges only after
the review subagent reports ✅ all checks passed. If a review finds
unfixable issues (design flaw, missing spec clarity), the merge is
blocked and the user decides.

**One review subagent per worktree.** Reviews run in parallel — each
worktree is independent. This matches the pattern in `execute`.

## Prerequisites

1. Manifest exists at `.plan/<DD-MM-YYYY>/<name>/tasks/manifest.md`
2. Worktrees exist under `.worktrees/<id>-<slug>/` with implemented code
3. `execute` has completed (or tasks were implemented manually)

## Workflow

### Phase 1: Determine Merge Target

1. Identify the original working branch — this is the branch that was
   active when worktrees were created. Usually the current branch of the
   main repository checkout. Confirm with the user before merging.

2. If uncertain, ask: "Merge worktree branches into which branch?"

### Phase 2: Spawn Review Subagents

3. For every task in the manifest, spawn a review subagent simultaneously:
   ```
   terminal(
       command="hermes chat -q \"<review-prompt>\"",
       workdir=".worktrees/<id>-<slug>",
       background=true,
       notify_on_complete=true,
       timeout=1800
   )
   ```

4. Each subagent receives a structured prompt built from the checklist.
   See "Review Subagent Prompt" below.

### Phase 3: Collect Review Results

5. Wait for all review subagents to complete via `process(action='wait')`.

6. For each completed review:
   - ✅ All checks passed → mark 🟢 reviewed, ready to merge
   - ⚠️ Issues found + fixed → mark 🟢 reviewed (fixed), ready to merge
   - ❌ Unfixable issues → mark 🔴 blocked, ask user

### Phase 4: Merge Passed Reviews

7. For each 🟢 reviewed worktree:
   ```bash
   cd <main-repo-root>
   git merge agent/<id>-<slug>
   ```
   If merge conflicts occur (rare — file ownership map prevents this),
   report and ask the user to resolve.

8. After successful merge:
   ```bash
   git worktree remove .worktrees/<id>-<slug>
   git branch -d agent/<id>-<slug>
   ```

### Phase 5: Report

9. Print summary:
   ```
   ## Review Complete

   🟢 T1: register — merged to main, worktree cleaned
   🟢 T2: login — merged to main, worktree cleaned
   🔴 T3: verify-email — BLOCKED (design issue: missing rate-limiting spec)

   Merged: 2/3 | Blocked: 1/3
   Remaining worktrees: .worktrees/3-t3-verify-email/
   ```

## Review Subagent Prompt

The exact `hermes chat -q` prompt for each review subagent:

```
You are a code reviewer inside a git worktree. Your job is to exhaustively
audit the code in this directory against the task specification.

FIRST: Read TASK.md at the root of this directory. It contains:
- The task specification (what should be built)
- Interface contracts (what other tasks promise, what this task exports)
- File ownership (which files this task created/edited)
- Project rules (boundaries, conventions)
- The verification command

SECOND: Read every file listed in the File Ownership section of TASK.md.
Read the test files too.

THIRD: Run the verification command from TASK.md. Note its current status.

FOURTH: Work through EVERY category in the review checklist below. For
each category, examine the code methodically. Answer EXPLICITLY with
one of: ✅ PASS, ⚠️ FIXED (describe what you fixed), or ❌ BLOCKED
(describe why it cannot be fixed in this worktree).

FIFTH: Fix every issue you find. Edit the code in this worktree. After
each fix, re-run the verification command to confirm nothing broke.
If a fix introduces new issues, fix those too. Iterate until clean.

SIXTH: After all categories pass or are fixed, report your final verdict.

--- REVIEW CHECKLIST ---

## 1. Spec Compliance
Does the code implement EVERY requirement in the spec?
- Each acceptance criterion: explicitly check if implemented
- Each data shape / schema: compare actual code to spec
- Each endpoint / function signature: matches spec?
- Any spec requirement NOT implemented? → BLOCKED

## 2. Interface Contract Adherence
Does the code match the contracts it exports AND consume contracts correctly?
- Exported: does this task's code produce exactly what the contract says?
- Consumed: does this task's code use the contracts as defined?
- Any contract mismatch? → fix or BLOCKED

## 3. Edge Cases — Inputs
Enumerate every edge case for every function/endpoint:
- Empty input (null, "", [], {})
- Maximum-length input
- Invalid types (string where int expected)
- Unicode / special characters
- Negative numbers where only positive expected
- Zero values
- Boundary values (INT_MAX, empty list, single element)
Does the code handle each? If not, add handling.

## 4. Edge Cases — State
Enumerate every edge case for application state:
- Resource not found (404)
- Resource already exists (409 conflict)
- Unauthorized (401) / forbidden (403)
- Rate limited (429)
- Service unavailable / timeout
- Concurrent modification (race conditions)
- Transaction rollback on partial failure
Does the code handle each? If not, add handling.

## 5. Conditional Branches
For every if/else, switch/match, ternary, and guard clause:
- Are all branches reachable? (no dead code)
- Is there a default/else fallback?
- Does every branch return or handle control flow correctly?
- Are boolean conditions correct (no inverted logic)?
- Does the happy path AND error path both work?

## 6. Error Handling
- Every function that can fail: does it raise or return an error?
- Are exceptions caught at the right level?
- Are error messages informative (not just "error")?
- Are error responses consistent with the project's API conventions?
- Is any exception silently swallowed?
- Are resource cleanups (file handles, DB connections) in finally/context manager?

## 7. Test Coverage
- Do tests cover the happy path?
- Do tests cover at least the most common error paths?
- Do tests cover the edge cases listed above?
- Are test assertions meaningful (not just `assert True`)?
- Do tests actually test this task's code (not just pass trivially)?

## 8. Project Rules Compliance
- No secrets, API keys, or .env files committed
- Type annotations present on all new functions
- Follows existing naming conventions
- No edits to files outside File Ownership
- No drive-by refactors of unrelated code

## 9. Security (if applicable)
- SQL injection: are queries parameterized?
- XSS: is user input escaped in output?
- Auth: are endpoints properly protected?
- Input validation: is all user input validated before use?
- Sensitive data: passwords hashed? tokens not logged?

## 10. Code Quality
- No duplicate code that should be extracted
- No overly complex functions (>50 lines? justify or split)
- No magic numbers (use named constants)
- No dead code or commented-out blocks
- Imports are used (no unused imports)
- Docstrings on public functions

--- REVIEW OUTPUT FORMAT ---

After completing the checklist, output:

### Review Verdict: ✅ PASS / ⚠️ FIXED / ❌ BLOCKED

### Issues Found & Fixed
- [Fixed] <category>: <what was wrong> → <what you changed>
- [Fixed] <category>: <what was wrong> → <what you changed>

### Unresolved Issues
- [Blocked] <category>: <what is wrong> — <why cannot fix here>

### Verification
<verification command output after all fixes>
```
```

## Merge + Cleanup Commands

```bash
# Merge worktree branch into target branch
cd <main-repo-root>
git merge agent/<id>-<slug>

# If merge conflicts (should be rare):
# Resolve conflicts, then:
git add .
git commit -m "merge: integrate <id>-<slug> review fixes"

# Remove worktree
git worktree remove .worktrees/<id>-<slug>

# Delete merged branch
git branch -d agent/<id>-<slug>

# Clean stale worktree metadata
git worktree prune
```

## Gotchas

- **Review subagent has write access.** It edits the code in the worktree
  directly. This is intentional — the worktree is disposable and the branch
  captures the review fixes. If the review subagent makes bad edits, the
  orchestrator (you) sees them in the merge diff before merging.
- **Review subagent runs tests after every fix.** If a fix breaks tests,
  the subagent must fix the regression before proceeding to the next
  checklist item. The orchestrator trusts the subagent's final verification
  output.
- **Unfixable issues are valid outcomes.** Some issues can't be fixed in
  the worktree: a missing spec requirement, a design contradiction between
  two tasks' contracts, a dependency on infrastructure not available in
  the worktree. Mark these ❌ BLOCKED and let the user decide.
- **Merge conflicts should be extremely rare.** The file ownership map
  guarantees no two tasks edit the same file. Merge conflicts only arise
  if the review subagent edits a file that was also changed on the target
  branch since the worktree was created — which shouldn't happen if the
  pipeline runs without human intervention.
- **Review subagent runs in the worktree, not outside.** The `workdir`
  parameter of `terminal` locks it to the worktree. It cannot read or
  write files in the main repository.
- **Parallel reviews are safe.** Each review subagent works in a different
  worktree with different files. No coordination needed.

## References

- `assets/review-checklist.md` — The complete 10-category checklist that
  review subagents follow. This is the same checklist embedded in the
  review prompt above, in standalone form for when the orchestrator
  needs to run a manual review.
