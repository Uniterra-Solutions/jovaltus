# Task Manifest: {{plan-name}}

> **Generated:** {{timestamp}} | **Plan:** `.plan/{{DD-MM-YYYY}}/{{name}}/`
> **Total tasks:** {{N}} | **Execution:** All tasks are independent — dispatch in parallel

---

## Task Inventory

_All tasks own disjoint files. Zero shared write targets. All can run simultaneously._

| Task ID | Slug | Task File | Worktree | Branch | Verification |
|---------|------|-----------|----------|--------|-------------|
| {{T1}} | {{slug}} | `.plan/.../tasks/task-{{t1}}-{{slug}}.md` | `.worktrees/{{t1}}-{{slug}}/` | `agent/{{t1}}-{{slug}}` | `pytest tests/... -v` |
| {{T2}} | {{slug}} | `.plan/.../tasks/task-{{t2}}-{{slug}}.md` | `.worktrees/{{t2}}-{{slug}}/` | `agent/{{t2}}-{{slug}}` | `pytest tests/... -v` |
| {{T3}} | {{slug}} | `.plan/.../tasks/task-{{t3}}-{{slug}}.md` | `.worktrees/{{t3}}-{{slug}}/` | `agent/{{t3}}-{{slug}}` | `pytest tests/... -v` |
| {{...}} | ... | ... | ... | ... | ... |

---

## File Ownership Map

_Every file belongs to exactly one task. Zero overlap proves parallel-safe execution._

| File | Owner | Action |
|------|-------|--------|
| `src/auth/register.py` | {{T1}} | CREATE |
| `src/auth/login.py` | {{T2}} | CREATE |
| `src/auth/__init__.py` | {{T1}} | EDIT |
| `src/auth/jwt.py` | {{T1}} | CREATE |
| `src/models/user.py` | {{T3}} | CREATE |
| `tests/auth/test_register.py` | {{T1}} | CREATE |
| `tests/auth/test_login.py` | {{T2}} | CREATE |
| `tests/models/test_user.py` | {{T3}} | CREATE |
| {{...}} | ... | ... |

**Validation:** {{N}} files, {{N}} unique owners → ✅ zero conflicts.

---

## Interface Contract Map

_Every cross-task dependency has an inlined contract. No task reads another task's output at runtime._

| Producer | Exports | Consumer | Contract Inlined In Consumer's TASK.md |
|----------|---------|----------|----------------------------------------|
| {{T1}} | `create_token(user_id) -> str` | {{T3}} | ✅ task-{{t3}}-{{slug}}.md |
| {{T1}} | `POST /api/auth/register` shape | {{T4}} | ✅ task-{{t4}}-{{slug}}.md |
| {{T2}} | `authenticate(email, password) -> User` | {{T3}} | ✅ task-{{t3}}-{{slug}}.md |
| {{T3}} | `User` model class | {{T1}}, {{T2}} | ✅ task-{{t1}}, task-{{t2}} |
| {{...}} | ... | ... | ... |

**Validation:** {{M}} cross-task dependencies, {{M}} inlined contracts → ✅ fully covered.

---

## Dependency Graph (Informational)

_Logical relationships only. Does NOT constrain execution order — all tasks run in parallel._

```
T1 (register, jwt) ──→ T3 (middleware) ──→ T5 (integration)
                             ↗
T2 (login, session) ──→ T4 (profile) ────┘
```

---

## Execution Status

_Updated by the `execute` skill during execution._

| Task ID | Status | Started | Completed | Result |
|---------|--------|---------|-----------|--------|
| {{T1}} | ⬜ pending | — | — | — |
| {{T2}} | ⬜ pending | — | — | — |
| {{T3}} | ⬜ pending | — | — | — |
| {{T4}} | ⬜ pending | — | — | — |
| {{...}} | ⬜ pending | — | — | — |

Statuses: ⬜ pending | 🟡 running | 🟢 passed | 🔴 failed
