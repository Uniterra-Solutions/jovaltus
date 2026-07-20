# Review Checklist — Standalone Reference

_This is the same checklist embedded in the review subagent prompt.
Use this standalone version for manual reviews or when the orchestrator
needs to audit a worktree without spawning a subagent._

## Pre-Review

- [ ] Read TASK.md — understand spec, contracts, file ownership, verification
- [ ] Read all files in File Ownership section
- [ ] Run verification command — note baseline status

---

## 1. Spec Compliance

Every requirement in the spec has a corresponding implementation.

- [ ] Each acceptance criterion: explicitly checked against code
- [ ] Each data shape / schema: actual code matches spec
- [ ] Each endpoint / function signature: matches spec
- [ ] No spec requirement unimplemented
- [ ] No code that implements something NOT in the spec (scope creep)

## 2. Interface Contract Adherence

Code matches the contracts it exports AND consumes.

- [ ] Exported contracts: code produces exactly what contract promises
- [ ] Consumed contracts: code uses contracts as defined
- [ ] No contract mismatch between this task and what it expects from others

## 3. Edge Cases — Inputs

Every function/endpoint handles boundary inputs.

- [ ] Empty input: `null`, `""`, `[]`, `{}`, `None`
- [ ] Maximum-length input
- [ ] Invalid types: string where int expected, vice versa
- [ ] Unicode / special characters in strings
- [ ] Negative numbers where only positive expected
- [ ] Zero values
- [ ] Boundary values: `INT_MAX`, empty list, single-element list
- [ ] Duplicate values where uniqueness expected
- [ ] Missing required fields in request body

## 4. Edge Cases — State

Every operation handles unexpected application state.

- [ ] Resource not found (404)
- [ ] Resource already exists (409 conflict)
- [ ] Unauthorized access (401)
- [ ] Forbidden access (403)
- [ ] Rate limited (429)
- [ ] Service unavailable / timeout (503)
- [ ] Concurrent modification: two requests editing same resource
- [ ] Transaction rollback on partial failure
- [ ] Stale data: resource modified between read and write
- [ ] Database connection failure

## 5. Conditional Branches

Every branch is correct and complete.

- [ ] All branches reachable — no dead code
- [ ] Default/else fallback present where appropriate
- [ ] Every branch returns or handles control flow correctly
- [ ] Boolean conditions correct — no inverted logic
- [ ] Both happy path AND error path functional
- [ ] Nested conditionals: all combinations accounted for
- [ ] Early returns: all following code guarded correctly

## 6. Error Handling

Errors are caught, handled, and communicated appropriately.

- [ ] Functions that can fail: raise or return error explicitly
- [ ] Exceptions caught at appropriate level (not too broad, not too narrow)
- [ ] Error messages informative — describe what went wrong
- [ ] Error responses consistent with API conventions
- [ ] No silently swallowed exceptions
- [ ] Resource cleanup in finally/context manager (`with` statements)
- [ ] Retry logic for transient failures where appropriate
- [ ] Logging for unexpected errors (not just `print`)

## 7. Test Coverage

Tests are meaningful and cover the important paths.

- [ ] Happy path tested
- [ ] Most common error paths tested
- [ ] Edge cases from categories 3-4 tested where practical
- [ ] Assertions meaningful — not `assert True` or `assert 1 == 1`
- [ ] Tests actually exercise this task's code — not just pass trivially
- [ ] Test data realistic — not `"test"`, `123`, `"foo"`
- [ ] Mocks/stubs match the interface contracts where needed
- [ ] Negative tests: verify that invalid input is rejected

## 8. Project Rules Compliance

Code follows the project's established conventions.

- [ ] No secrets, API keys, or `.env` files committed
- [ ] Type annotations on all new functions (if project uses types)
- [ ] Follows existing naming conventions in touched files
- [ ] No edits to files outside File Ownership section
- [ ] No drive-by refactors of unrelated code
- [ ] No new dependencies added without being listed in Tech Stack

## 9. Security

No common vulnerability patterns present.

- [ ] SQL/NoSQL injection: queries parameterized, not string-interpolated
- [ ] XSS: user input escaped in HTML/JS output
- [ ] Authentication: endpoints properly protected
- [ ] Authorization: users can only access their own resources
- [ ] Input validation: all user input validated server-side
- [ ] Password handling: hashed (bcrypt/argon2), never logged
- [ ] Token handling: JWTs validated, not stored in localStorage-equivalent
- [ ] File uploads: type/size validated, not executed
- [ ] Sensitive data: PII, tokens, keys never logged or exposed in errors

## 10. Code Quality

Code is maintainable and follows good practices.

- [ ] No duplicate code that should be extracted into a shared function
- [ ] No functions over ~50 lines without clear justification
- [ ] No magic numbers — use named constants
- [ ] No dead code or large commented-out blocks
- [ ] All imports used — no unused imports
- [ ] Public functions have docstrings
- [ ] Variable names descriptive — not `x`, `tmp`, `data`
- [ ] Consistent formatting (the linter/formatter will catch this)

---

## Verdict Key

| Symbol | Meaning | Action |
|--------|---------|--------|
| ✅ | Category passes | Continue |
| ⚠️ | Issues found, FIXED in worktree | Document what was fixed |
| ❌ | Issues found, CANNOT fix in worktree | Document why — user decides |
