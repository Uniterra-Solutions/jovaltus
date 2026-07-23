# Task Manifest: {{plan-name}}

> **Generated:** {{timestamp}} | **Plan:** `.plan/{{DD-MM-YYYY}}/{{name}}/`
> **Total tasks:** {{N}} | **Execution:** All tasks are complete vertical slices — dispatch in parallel

---

## Task Inventory

_Each task is a complete vertical slice (implementation + tests + context). All tasks own disjoint files. Zero shared write targets. All can run simultaneously._

| Task ID | Slug | Owns Tests | Task File | Worktree | Branch | Verification |
|---------|------|------------|-----------|----------|--------|-------------|
| {{T1}} | {{slug}} | ✅ | `.plan/.../tasks/task-{{t1}}-{{slug}}.md` | `.worktrees/{{t1}}-{{slug}}/` | `agent/{{t1}}-{{slug}}` | `pytest tests/... -v` |
| {{T2}} | {{slug}} | ✅ | `.plan/.../tasks/task-{{t2}}-{{slug}}.md` | `.worktrees/{{t2}}-{{slug}}/` | `agent/{{t2}}-{{slug}}` | `pytest tests/... -v` |
| {{T3}} | {{slug}} | ✅ | `.plan/.../tasks/task-{{t3}}-{{slug}}.md` | `.worktrees/{{t3}}-{{slug}}/` | `agent/{{t3}}-{{slug}}` | `pytest tests/... -v` |
| {{...}} | ... | ... | ... | ... | ... | ... |

---

## File Ownership Map

_Every file belongs to exactly one task. Every test file owned by the same task as its implementation. Zero overlap proves parallel-safe execution._

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

**Validation:** {{N}} files, {{N}} unique write owners → ✅ zero write conflicts.
**Test bundling:** {{K}} test files, all owned by same task as their implementation → ✅ tests never split.

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
