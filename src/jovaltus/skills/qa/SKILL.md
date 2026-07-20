---
name: qa
description: >
  PRD-driven acceptance testing across all app types. Extracts every
  user-facing requirement from the PRD as a testable user journey and
  exercises each journey as a real user would — browser tools for web
  apps, terminal for CLI/API apps, computer-use for desktop apps.
  Finds issues during testing and fixes them immediately with regression
  tests. Loops until every PRD requirement is exercised and satisfied.
  Produces a structured QA report mapping requirements to evidence.
  LOAD when:
  - All worktrees merged, code integrated on the working branch
  - User says "qa" or "test" or "acceptance test" or "驗收" or "試用"
  - Ready to verify the integrated app against the PRD
  Do NOT use for:
  - Unit testing or integration testing (that's review/verify phase)
  - Testing before all worktrees are merged
  - Performance or load testing
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [qa, acceptance, testing, dogfood, browser, terminal, prd-driven]
---

# QA — PRD-Driven Acceptance Testing

## Goal

After all worktree branches are merged, act as a real user exercising every
requirement in the PRD. Find issues, fix them immediately with regression
tests, and re-run the journey. Only stop when every user-facing requirement
has been exercised and produces the expected outcome.

This is the final verification gate before the branch is ready to ship.

## Acceptance Criteria

- Every user-facing requirement from the PRD is exercised as a complete
  user journey (not just a page visit or single API call)
- Each journey produces a pass/fail verdict with evidence
- Issues found are fixed immediately in the working branch with regression tests
- Fixed journeys are re-run to confirm the fix works
- A structured QA report maps every PRD requirement → journey → outcome → evidence
- Unfixable issues are escalated to the user with clear reproduction steps

## Core Principles

**PRD is the contract.** Every user-facing requirement in the PRD becomes a
testable user journey. If the PRD says "users can register with email and
password," the journey is: open signup → fill form → submit → verify
confirmation email → sign in → see dashboard. Exercise the full journey,
not just the signup endpoint.

**App-type agnostic.** The skill works with any application type:
- **Web app** → Hermes browser tools (`browser_navigate`, `browser_snapshot`,
  `browser_click`, `browser_type`, `browser_vision`, `browser_console`)
- **CLI tool** → `terminal` for running commands and checking output
- **API service** → `terminal` with `curl` / `httpie` for request/response testing
- **Desktop app** → `computer-use` skill for screen capture + interaction
- **Library/SDK** → `execute_code` or `terminal` for import + exercise

The QA agent auto-detects the app type from the PRD and design doc, then
selects the appropriate toolset.

**Flows, not pages.** Test complete user journeys — not isolated features.
"Can log in" is a page test. "Can register → confirm email → log in → see
dashboard with correct name → log out" is a journey. The bugs live between
the pages/endpoints.

**Fix immediately, then re-run.** When a journey fails, don't just report it.
Fix the code, add a regression test that proves the fix, re-run the journey.
Iterate until it passes. Only escalate if the fix is beyond the skill's scope
(design flaw, missing infrastructure, ambiguous spec).

**Evidence for every verdict.** Pass or fail, every journey produces evidence:
- Pass: screenshot (web), terminal output (CLI), response dump (API)
- Fail: reproduction steps, expected vs actual, console errors, fix applied

## Prerequisites

1. All worktree branches merged into the working branch
2. PRD exists at `.plan/<DD-MM-YYYY>/<name>/prd.md`
3. Design doc exists at `.plan/<DD-MM-YYYY>/<name>/design.md`
4. App can be started/running on the working branch

## Workflow

### Phase 1: Detect App Type & Toolset

1. Read the PRD and design doc to determine the application type.
2. Select the appropriate toolset:

| App Type | Detection Signal | Primary Tools |
|----------|-----------------|---------------|
| **Web app** | URLs, pages, browser, HTML, CSS, React/Vue/Next.js | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_vision`, `browser_console` |
| **CLI tool** | Command-line, terminal, stdin/stdout, flags, arguments | `terminal` |
| **API service** | REST, GraphQL, endpoints, JSON, HTTP, curl | `terminal` with `curl` |
| **Desktop app** | GUI, window, Electron, native | `skill_view(name='computer-use')` then computer-use tools |
| **Library/SDK** | import, package, module, function | `execute_code` or `terminal` with Python/Node |

3. If uncertain, ask the user: "This looks like a [type] app. How should I interact with it?"

### Phase 2: Extract Journeys from PRD

4. Read every user-facing requirement in the PRD. For each, define a
   complete user journey:

   ```
   PRD Requirement: "Users can register with email and password"

   Journey: Register → Confirm → Login → Dashboard
     Step 1: Open signup page / call POST /auth/register
     Step 2: Fill registration form with test data
     Step 3: Submit and verify success response/redirect
     Step 4: (If email confirmation) check confirmation mechanism
     Step 5: Sign in with created credentials
     Step 6: Verify dashboard shows correct user info
     Step 7: Log out and verify session cleared

   Expected outcomes per step:
     Step 3: 201 Created / redirect to login
     Step 5: 200 OK with JWT token
     Step 6: Dashboard displays "Welcome, {test_name}"
     Step 7: 200 OK, token invalidated
   ```

5. Build a journey matrix — a flat list of journeys mapped to PRD requirements:
   | Journey ID | PRD Requirement | Steps | Expected Outcomes |

6. **Prioritize**: critical path first (core user flows), then secondary
   flows, then edge cases.

### Phase 3: Start the Application

7. Detect how to start the app from project config:
   - Python: `uv run uvicorn`, `python -m flask run`, `python main.py`
   - Node: `npm run dev`, `npx next dev`, `node server.js`
   - Go: `go run .`
   - Docker: `docker compose up`
   - Read `package.json` scripts, `Makefile`, `README.md` for run commands

8. Start the app in the background:
   ```
   terminal(command="<start-command>", background=true, workdir="<project-root>")
   ```

9. Wait for the app to be ready (poll health check endpoint or check stdout
   for "listening on port X" / "ready" signal).

### Phase 4: Execute Journeys

10. Work through the journey matrix one journey at a time. For each:

    a. **Announce**: "Testing journey J1: Register → Login → Dashboard (PRD §2.1)"
    
    b. **Execute** every step in the journey using the appropriate tools:
       - Web: navigate → snapshot → interact → screenshot → check console
       - CLI: run command → check exit code → check stdout/stderr
       - API: curl request → check status code → check response body
    
    c. **Verdict**: ✅ PASS or 🔴 FAIL
    
    d. **If FAIL**: describe what went wrong. Expected vs actual.

### Phase 5: Fix Loop

11. For each 🔴 FAIL:

    a. **Diagnose**: read relevant source code, check error messages
    
    b. **Fix**: edit the code to resolve the issue
    
    c. **Regression test**: add a test that fails before the fix and passes after
    
    d. **Re-run** the journey from step 1
    
    e. **Iterate** until the journey passes, or escalate if unfixable:
       - Design flaw (PRD requirement contradicts itself)
       - Missing infrastructure (no mail server for email confirmation)
       - Ambiguous spec (PRD doesn't specify behavior for this case)
       - Requires external service (payment gateway not configured)

### Phase 6: Report

12. Generate a structured QA report at `.plan/<DD-MM-YYYY>/<name>/qa-report.md`:

```markdown
# QA Report — {{plan-name}}

## Summary
- Total journeys: N
- Passed: X
- Failed & Fixed: Y
- Escalated: Z
- Total fixes applied: F

## Journey Results

### J1: Register → Login → Dashboard (PRD §2.1)
**Verdict:** ✅ PASS
**Toolset:** browser
**Evidence:** <screenshot-path>
**Steps executed:** 7/7 passed
**Fixes applied:** 0

### J2: Password Reset Flow (PRD §2.3)
**Verdict:** ✅ PASS (was 🔴, fixed)
**Toolset:** browser
**Issue found:** Reset link returned 500 when token expired
**Fix:** Added token expiry check + 410 Gone response
**Regression test:** `test_expired_reset_token_returns_410`
**Re-run:** ✅ PASS

### J3: Rate Limiting (PRD §3.1)
**Verdict:** ⚠️ ESCALATED
**Issue:** Rate limiting requires Redis — not configured in this environment
**Recommendation:** Deploy to staging and re-test with Redis

## Escalations
1. J3: Rate limiting needs Redis — add to infra setup
```

## App-Type Specific Guidance

### Web App (Browser Tools)

```
# Navigate + snapshot
browser_navigate(url="http://localhost:3000/signup")
browser_snapshot()

# Interact
browser_type(ref="@e1", text="test@example.com")
browser_type(ref="@e2", text="Password123!")
browser_click(ref="@e3")

# Verify
browser_vision(question="Is the dashboard visible? Does it say 'Welcome, Test User'?")
browser_console()  # Check for JS errors
```

### CLI Tool (Terminal)

```
# Run with valid input
terminal(command="mycli create-user --email test@example.com --name 'Test User'")

# Check exit code and output
# Expected: exit 0, stdout contains "User created"

# Test edge cases
terminal(command="mycli create-user --email '' --name ''")
# Expected: exit 1, stderr contains "email is required"
```

### API Service (Terminal + curl)

```
# Happy path
terminal(command="curl -s -X POST http://localhost:8000/auth/register \\
  -H 'Content-Type: application/json' \\
  -d '{\"email\":\"test@test.com\",\"password\":\"Pass123!\"}'")

# Expected: 201, body contains user_id and token

# Error case
terminal(command="curl -s -X POST http://localhost:8000/auth/register \\
  -H 'Content-Type: application/json' \\
  -d '{\"email\":\"\",\"password\":\"\"}'")

# Expected: 422, body contains validation errors
```

### Desktop App (Computer Use)

```
# Load the computer-use skill
skill_view(name="computer-use")

# Then use computer-use tools to:
# - Take screenshots
# - Click on UI elements
# - Type into fields
# - Verify visual state
```

### Library/SDK (execute_code or terminal)

```
# Exercise the library programmatically
execute_code(code="""
from mylib import create_user
result = create_user(email="test@test.com", password="Pass123!")
assert result.success is True
assert result.user_id is not None
print("PASS: create_user works")
""")
```

## Gotchas

- **Journeys, not unit tests.** A unit test verifies `create_user()` returns
  a user ID. A journey verifies: register → get confirmation → sign in →
  see correct data → sign out. The gaps between steps are where bugs hide.
- **Start the app once, keep it running.** Don't restart for every journey.
  Use one background terminal session for the server.
- **Test data hygiene.** Create test users with unique identifiers so journeys
  don't collide. Clean up test data after each journey or at the end.
- **Realistic test data.** Don't use "test", "foo", "123". Use realistic names
  and emails so any rendering/validation issues with real data surface.
- **Console errors are bugs.** Even if the UI looks fine, a red console is a
  finding. Check `browser_console()` after every interaction.
- **Empty states.** Every list page should be tested with zero items. Every
  dashboard with a new user. These states are consistently broken.
- **Escalate, don't guess.** If a journey fails and the cause is unclear,
  or the fix requires a design decision, escalate with reproduction steps.
  Don't make assumptions about what the behavior should be.
- **PRD is the source of truth.** If the actual behavior differs from the
  PRD, flag it. Either the code is wrong (fix it) or the PRD is wrong
  (update it). Don't silently accept the discrepancy.
