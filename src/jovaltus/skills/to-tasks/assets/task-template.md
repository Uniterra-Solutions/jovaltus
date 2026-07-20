# Task {{ID}}: {{Task Name}}

> **Estimated effort:** {{15-30 min}}
> **Depends on:** {{logical dependency info — informational only, does not block execution}}
>   {{e.g., "T1 produces jwt.py (contract inlined below) — T3 codes against contract"}}

## File Ownership

_Every file below is owned EXCLUSIVELY by this task. No other task touches these files._

| Action | Path | Description |
|--------|------|-------------|
| CREATE | `{{src/auth/register.py}}` | {{Registration endpoint handler}} |
| EDIT | `{{src/auth/__init__.py}}` | {{Register the new route}} |
| CREATE | `{{tests/auth/test_register.py}}` | {{Tests for registration}} |
| READ | `{{src/models/user.py}}` | {{Existing user model — read for context, do not modify}} |

## Interface Contracts

### From Other Tasks (What This Task Needs)

_These are the contracts other tasks promise to fulfill. Code against these signatures — the real implementations will exist when all tasks merge._

| From Task | What | Contract |
|-----------|------|----------|
| {{T1}} | {{JWT creation}} | `def create_token(user_id: UUID) -> str` — returns signed JWT string |
| {{T2}} | {{User model}} | `class User(BaseModel): id: UUID, email: str, name: str` |
| {{...}} | {{...}} | {{...}} |

### Exported (What This Task Produces for Others)

_These are the contracts this task promises. Other tasks will inline these._

| What | Contract |
|------|----------|
| {{Registration handler}} | `POST /api/auth/register` — body: `{email, password, name}` → `{user_id, token}` |
| {{...}} | {{...}} |

## Specification

{{FULL spec content inline. Copy-paste from specs/<spec-file>.md.
Do NOT reference or link. The subagent reads THIS, not the original.}}

---

{{Spec content starts here — objective, requirements, acceptance criteria,
data shapes, boundaries, edge cases, out of scope — everything.}}

## Design Excerpts

{{Only the parts of design.md relevant to THIS task. Extract, don't link.}}

### Data Model

{{Tables, columns, types, constraints this task touches.}}

```sql
-- Relevant schema excerpt
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API Conventions

- Response format: `{"data": {...}}` for success, `{"error": "...", "message": "..."}` for errors
- Auth: Bearer JWT in Authorization header
- Status codes: 200/201 success, 400/422 validation, 401 auth, 403 forbidden, 409 conflict, 500 server error

### Tech Stack (this task)

- **Language:** {{Python 3.12}}
- **Framework:** {{FastAPI 0.115}}
- **Database:** {{PostgreSQL 16, SQLAlchemy 2.0}}
- **Key deps:** {{bcrypt, pydantic, pytest}}

## Project Rules

{{Inline the Always / Ask / Never boundaries that apply to this task.
Extract from AGENTS.md, CLAUDE.md, or equivalent.}}

### Allowed

- Run the verification command before declaring done
- Follow existing naming conventions in touched files
- Add type annotations for all new functions
- Write tests alongside implementation
- Create stub/mock implementations for interface contracts from other tasks
  if the verification command needs them to compile/import

### Needs Approval

- Adding a new dependency not listed in Tech Stack
- Modifying database schema beyond what's specified above
- Editing a file not listed in File Ownership

### Forbidden

- Commit secrets, API keys, or .env files
- Edit generated code or vendor directories
- Delete or weaken existing tests
- Change the public API of exported functions without updating the contract
- Touch any file not listed in File Ownership above
- Modify any file marked as READ

## Verification

```bash
{{Exact command that proves this task is complete. Must work in isolation —
no other tasks' code needs to exist. If the command imports code from
another task, create a lightweight stub that matches the interface contract.}}

# Example:
cd /path/to/worktree
pytest tests/auth/test_register.py -v
```

### Expected Result

```
{{What passing output looks like.}}

tests/auth/test_register.py::test_valid_registration PASSED
tests/auth/test_register.py::test_duplicate_email PASSED
tests/auth/test_register.py::test_weak_password PASSED
tests/auth/test_register.py::test_missing_fields PASSED
```

## Notes

- {{Any context the subagent needs that doesn't fit above.}}
- {{e.g. "The user model migration already exists — only add the endpoint."}}
- {{e.g. "If the verification imports from a module that doesn't exist yet
  (owned by another task), create a minimal stub that matches the contract."}}
