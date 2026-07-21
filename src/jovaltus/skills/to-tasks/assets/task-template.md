# Task {{ID}}: {{Task Name}}

> **Estimated effort:** {{30-60 min}} — complete vertical slice, self-contained
> **Depends on:** {{logical dependency info — informational only, does not block execution}}
>   {{e.g., "T1 produces jwt.py (contract inlined below) — T3 codes against contract"}}

## File Ownership

_Every file below is owned EXCLUSIVELY by this task. No other task touches these files.
Tests for implementation files are ALWAYS owned by this same task — never split out._

| Action | Path | Description |
|--------|------|-------------|
| CREATE | `{{src/auth/register.py}}` | {{Registration endpoint handler}} |
| EDIT | `{{src/auth/__init__.py}}` | {{Register the new route}} |
| CREATE | `{{tests/auth/test_register.py}}` | {{Tests for registration — same task as implementation}} |
| READ | `{{src/models/user.py}}` | {{Existing user model — full content inlined in Referenced Code below}} |

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

## Referenced Code

_Full source (or key excerpts) of every file marked READ in the ownership table.
The subagent needs this to understand existing patterns, conventions, and data
shapes before writing any code. Copy-paste the actual file content — don't just
reference the path. The subagent reads THIS inline context, not the file on disk._

### `{{src/models/user.py}}`

```python
{{Full content of user.py — the subagent reads THIS to understand the model}}
```

### `{{src/config.py}}` (key excerpts)

```python
{{Only the relevant parts — database URL, secret key config, etc.}}
```

## Specification

{{FULL spec content inline. Copy-paste from ALL relevant spec files that this
task covers. Multiple specs can condense into one task. Do NOT reference or
link. The subagent reads THIS, not the originals.}}

---

{{All spec content — objective, requirements, acceptance criteria,
data shapes, boundaries, edge cases, out of scope — everything from
every spec file that this task covers.}}

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
no other tasks' code needs to exist. Tests for this task's code are already
owned by this task, so the verification command runs them directly.}}

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
- {{e.g. "Tests are owned by this task — include them in file ownership and write them alongside implementation."}}
