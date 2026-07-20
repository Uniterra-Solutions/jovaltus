# Task {{ID}}: {{Task Name}}

> **Wave:** {{N}} | **Depends on:** {{task IDs or "None (Wave 1)"}}
> **Estimated effort:** {{15-30 min}}

## Dependency

### Inputs

{{List exact files or artifacts from predecessor tasks that this task needs.
If Wave 1, write "None — this is a Wave 1 (seed) task."}}

| From Task | Artifact | Path |
|-----------|----------|------|
| {{T2}} | {{JWT utility module}} | `src/auth/jwt.py` |
| {{...}} | {{...}} | {{...}} |

### Outputs

{{List every file and test this task creates or modifies. These become
inputs for downstream tasks.}}

| Action | Path | Description |
|--------|------|-------------|
| CREATE | `{{src/auth/register.py}}` | {{Registration endpoint handler}} |
| CREATE | `{{tests/auth/test_register.py}}` | {{Tests for registration}} |
| EDIT | `{{src/auth/__init__.py}}` | {{Register the new route}} |

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
- **Key deps:** {{bcrypt, pydantic, pytest, httpx (for test client)}}

## Project Rules

{{Inline the Always / Ask / Never boundaries that apply to this task.
Extract from AGENTS.md, CLAUDE.md, or equivalent.}}

### Allowed

- Run the verification command before declaring done
- Follow existing naming conventions in touched files
- Add type annotations for all new functions
- Write tests alongside implementation

### Needs Approval

- Adding a new dependency not listed in Tech Stack
- Modifying database schema beyond what's specified above
- Editing a file not listed in Outputs

### Forbidden

- Commit secrets, API keys, or .env files
- Edit generated code or vendor directories
- Delete or weaken existing tests
- Change the public API of exported functions
- Touch any file not listed in Outputs above

## Verification

```bash
{{Exact command that proves this task is complete. Must work from a clean
worktree checkout with all Wave 1..N-1 artifacts present.}}

# Example:
cd /path/to/worktree
pytest tests/auth/test_register.py -v
```

### Expected Result

```
{{What passing output looks like — so the subagent knows when it's done.}}

tests/auth/test_register.py::test_valid_registration PASSED
tests/auth/test_register.py::test_duplicate_email PASSED
tests/auth/test_register.py::test_weak_password PASSED
tests/auth/test_register.py::test_missing_fields PASSED
```

## Notes

- {{Any context the subagent needs that doesn't fit above.}}
- {{e.g. "The user model migration already exists — only add the endpoint."}}
- {{e.g. "Reuse the password validator from src/auth/validators.py (READ only, do not edit)."}}
