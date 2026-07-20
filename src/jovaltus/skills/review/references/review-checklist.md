# Adversarial Review Checklist — 4-Layer

_This checklist embodies the adversarial review methodology. The reviewer
does not evaluate quality — it constructs failure scenarios. Every layer
must be completed before reporting. Every fix demands an evidence test._

---

## Pre-Review (Mandatory First Steps)

- [ ] Read TASK.md — understand spec, contracts, file ownership, verification
- [ ] Read every file listed in File Ownership (code + tests)
- [ ] Run verification command — note baseline status
- [ ] **CI GAMING CHECK**: scan `.github/workflows/`, CI config, test configs.
      Did the agent remove failing tests? Skip lint? Lower coverage threshold?
      If YES → 🔴 BLOCKED. Revert CI changes before proceeding.
- [ ] **SCOPE CREEP CHECK**: did the agent change files NOT in File Ownership?
      If YES → revert those changes or flag for review.

---

## Layer 1: Assumption Violation

_For every function, enumerate what it assumes. Then violate each assumption._

### 1A. Data Shape Assumptions

For every function parameter, return value, and data access:

- [ ] **Null/None**: what if this is null?
- [ ] **Empty**: what if string is `""`, list is `[]`, dict is `{}`?
- [ ] **Missing fields**: what if required JSON field is absent?
- [ ] **Wrong type**: string where int expected? int where string expected?
- [ ] **Unicode/special chars**: emoji, RTL override, null byte, `\x00`
- [ ] **Maximum length**: 10MB string? 1M element array?
- [ ] **Boundary values**: `INT_MAX`, `INT_MIN`, `0`, `-1`, `NaN`, `Infinity`
- [ ] **Duplicate values**: where uniqueness is expected

For each: construct the specific input, trace through code, report result.

### 1B. Timing Assumptions

- [ ] **Operation order**: does code assume A happens before B? What if B first?
- [ ] **Timeout**: does code assume operation completes within a time window?
      What if it takes longer?
- [ ] **Resource existence**: does code assume a file/DB row exists when accessed?
      What if it was deleted between check and use? (TOCTOU)
- [ ] **Concurrent access**: can two requests interleave? What happens?
- [ ] **Clock skew**: what if `now()` returns a past timestamp? Future timestamp?

### 1C. Value Range Assumptions

- [ ] **Positive-only**: does code assume ID/count/age > 0? What if 0 or -1?
- [ ] **Finite**: does code assume a value fits in memory? What if unbounded?
- [ ] **Valid enum**: does code assume a status field is one of {A, B, C}?
      What if it's "X" or null?
- [ ] **Monotonic**: does code assume timestamps only increase? What if they
      don't (daylight savings, clock reset)?

### 1D. Environmental Assumptions

- [ ] **Config present**: does code assume env var / config key exists?
      What if missing?
- [ ] **Network available**: does code assume external service is reachable?
      What if DNS fails? Connection refused? 5-second timeout?
- [ ] **Disk space**: does code assume write will succeed? What if disk full?
- [ ] **Permissions**: does code assume file is readable/writable? What if 403?

---

## Layer 2: Composition Failures

_Trace interactions across component boundaries. Each component correct in
isolation; the COMBINATION fails._

### 2A. Contract Mismatches

- [ ] **Caller ↔ Callee**: does the caller pass values the callee doesn't expect?
- [ ] **Return value interpretation**: does the caller interpret the return
      value differently than the callee intends? (e.g., `null` = "not found" vs
      `null` = "error")
- [ ] **Error type mismatch**: does component A throw `ValueError` but component
      B catches `KeyError`? Error propagates uncaught.
- [ ] **Interface contracts**: does this task's code actually match what it
      promised in the Exported contracts? Does it consume contracts from
      other tasks correctly?

### 2B. Shared State Mutations

- [ ] **Read-after-write**: does code read a value, then write based on it,
      without locking? (race condition)
- [ ] **Write-after-write**: can two operations overwrite each other?
- [ ] **Cache invalidation**: is cached data stale after a mutation?
- [ ] **Transaction boundaries**: are multiple mutations in one transaction?
      What if the second mutation fails — does the first roll back?

### 2C. Ordering Across Boundaries

- [ ] **Initialization order**: does component A assume B is initialized first?
      Is that enforced?
- [ ] **Cleanup order**: does component A's cleanup run before B stops needing it?
- [ ] **Callback timing**: can a callback fire before setup completes? After
      teardown starts?

### 2D. Error Propagation

- [ ] **Error swallowing**: is any exception caught and silently ignored?
- [ ] **Error transformation**: is error information lost when wrapped?
      (e.g., original exception message dropped)
- [ ] **Retry storms**: does a failure trigger retry that triggers more failures?
- [ ] **Partial failure**: if a batch operation fails halfway, is state consistent?

---

## Layer 3: Exhaustive Path & Edge Enumeration

_DEEP + STANDARD. Walk every code path mechanically. Do not use intuition._

### 3A. Conditional Branch Walk

For EVERY if/else, switch/match, ternary, guard clause, early return:

- [ ] Are ALL branches reachable? (no dead code)
- [ ] Is there a default/else fallback for unexpected values?
- [ ] Does every branch return or handle control flow correctly?
- [ ] Are boolean conditions correct? (no inverted `>`, no `==` where `is` needed)
- [ ] Nested conditionals: all 2^N combinations accounted for?
- [ ] Early return: does code after the return correctly assume the guard passed?
- [ ] **Implicit branches**: if the code handles cases RED and YELLOW of a
      RED/YELLOW/GREEN enum, GREEN is an implicit branch — is it handled?

### 3B. Loop Boundary Walk

For EVERY loop (for, while, list comprehension, recursion):

- [ ] Empty input: what if the iterable is empty? (zero iterations)
- [ ] Single element: boundary case — does it work?
- [ ] Large input: what if 1M elements? Memory? Performance?
- [ ] Off-by-one: is the loop condition correct at boundaries?
- [ ] Infinite loop: can any input cause non-termination?
- [ ] Modification during iteration: is the collection mutated mid-loop?

### 3C. Error Path Walk

For EVERY try/except, error handler, error return:

- [ ] Is the error actually REACHABLE? (construct input that triggers it)
- [ ] Is error information preserved in logs/messages?
- [ ] Does error handling clean up resources? (file handles, DB connections,
      locks acquired before the error point)
- [ ] Does error response match API conventions?
- [ ] Can the error handler ITSELF fail? (error in error handler)

### 3D. State Transition Walk

For every stateful entity (user, order, session, workflow):

- [ ] All valid transitions: enumerate every legal state → state change
- [ ] Invalid transitions: attempt every illegal state change — rejected?
- [ ] Concurrent transitions: two requests try to transition simultaneously
- [ ] Stale state: entity modified between read and write

---

## Layer 4: Cascade Construction

_DEEP only. Build multi-step failure chains._

### 4A. Resource Exhaustion Cascades

- [ ] **Connection pool**: what if all connections are in use? Does it queue?
      Timeout? Deadlock?
- [ ] **Memory**: what if input is unbounded? Streaming or all-in-memory?
- [ ] **File descriptors**: what if too many open files?
- [ ] **Retry amplification**: A fails → B retries 3× → creates 3× more work
      for A → A fails harder → B retries more aggressively

### 4B. State Corruption Propagation

- [ ] **Partial write → bad read → bad decision**: A writes incomplete data → B
      reads it → B makes a decision based on corrupted data → C acts on B's
      bad decision
- [ ] **Rollback failure → inconsistent state**: transaction fails, rollback
      also fails → DB is in unknown state → next operation reads garbage

### 4C. Recovery-Induced Failures

- [ ] **Retry creates duplicate**: operation fails after side effect → retry
      creates second side effect → duplicate resource, double charge
- [ ] **Rollback deletes new data**: operation A creates data → operation B
      fails → rollback incorrectly deletes A's data
- [ ] **Health check cascade**: health check fails → load balancer removes
      instance → remaining instances get more traffic → their health checks
      also fail → all instances removed

### 4D. Cross-Component Cascades (if multiple modules)

- [ ] **Downstream timeout**: A calls B (times out) → A retries → B now has
      2 requests → B slows down → more A timeouts → retry storm
- [ ] **Cache stampede**: cache expires → ALL requests hit DB simultaneously
      → DB overloaded → timeouts → cache never repopulated

---

## Post-Review: Evidence Test Protocol

_For every fix made during review:_

- [ ] **Evidence test exists**: a test that FAILS on pre-fix code, PASSES on
      post-fix code
- [ ] **Test is minimal**: tests exactly the bug, not unrelated behavior
- [ ] **Test name describes the bug**: `test_returns_400_when_email_is_null`,
      not `test_edge_case_3`
- [ ] **Verification re-run**: full test suite passes after all fixes

---

## Verdict Format

```
### Review Verdict: ✅ PASS / ⚠️ FIXED / ❌ BLOCKED

### Depth Applied: DEEP / STANDARD / QUICK

### Issues Found & Fixed
- [Layer 1A] data shape: login() crashed on null email → added guard + test
- [Layer 2A] contract mismatch: called create_token() with int, expected UUID
  → fixed type + added conversion
- [Layer 3A] implicit branch: handled RED/YELLOW, missed GREEN → added default

### Evidence Tests Created
- test_login_returns_400_on_null_email (FAIL→PASS)
- test_create_token_accepts_int_user_id (FAIL→PASS)

### Unresolved Issues
- [Layer 4A] connection pool exhaustion: no retry backoff
  → BLOCKED: requires infrastructure config not available in worktree

### Final Verification
(pytest output showing all tests pass)
```

## Calibration Reference

| Risk Signal | Depth | Layers | Time Budget |
|-------------|-------|--------|-------------|
| auth, payment, crypto, PII, session, webhook, migration | DEEP | 1-4 | 15-20 min |
| CRUD, business logic, data processing | STANDARD | 1-3 | 8-12 min |
| utility, config, docs, test-only, refactor (no logic change) | QUICK | 1-2 | 3-5 min |
