# Task Manifest: {{plan-name}}

> **Generated:** {{timestamp}} | **Plan:** `.plan/{{DD-MM-YYYY}}/{{name}}/`
> **Total tasks:** {{N}} | **Waves:** {{M}} | **Max parallelism:** {{max tasks in any wave}}

---

## Execution Order

```
Wave 1 (parallel — no dependencies):
  ┌─ T1: {{task-1-slug}}
  └─ T2: {{task-2-slug}}

Wave 2 (after Wave 1 — depends on T1):
  ┌─ T3: {{task-3-slug}}
  └─ T4: {{task-4-slug}}

Wave 3 (after Wave 2 — depends on T3, T4):
  └─ T5: {{task-5-slug}}
```

## Wave Breakdown

### Wave 1 (Seed — no dependencies)

| Task ID | Slug | Worktree | Verification |
|---------|------|----------|-------------|
| {{T1}} | {{register}} | `.worktrees/1-{{t1}}-{{slug}}/` | `pytest tests/auth/test_register.py -v` |
| {{T2}} | {{login}} | `.worktrees/1-{{t2}}-{{slug}}/` | `pytest tests/auth/test_login.py -v` |

**Parallelism:** All {{2}} tasks in this wave run simultaneously — zero shared files.

**File write map (no conflicts):**
| Task | Writes |
|------|--------|
| T1 | `src/auth/register.py`, `tests/auth/test_register.py` |
| T2 | `src/auth/login.py`, `tests/auth/test_login.py` |

### Wave 2 (after Wave 1 completes)

| Task ID | Slug | Worktree | Depends On | Verification |
|---------|------|----------|------------|-------------|
| {{T3}} | {{verify-email}} | `.worktrees/2-{{t3}}-{{slug}}/` | T1 (`src/auth/register.py`) | `pytest tests/auth/test_verify.py -v` |
| {{T4}} | {{session}} | `.worktrees/2-{{t4}}-{{slug}}/` | T2 (`src/auth/login.py`) | `pytest tests/auth/test_session.py -v` |

**Parallelism:** All {{2}} tasks in this wave run simultaneously — different files from each other AND from Wave 1 outputs.

**File write map (no conflicts):**
| Task | Writes |
|------|--------|
| T3 | `src/auth/verify.py`, `tests/auth/test_verify.py` |
| T4 | `src/auth/session.py`, `tests/auth/test_session.py` |

### Wave 3 (after Wave 2 completes)

| Task ID | Slug | Worktree | Depends On | Verification |
|---------|------|----------|------------|-------------|
| {{T5}} | {{integration}} | `.worktrees/3-{{t5}}-{{slug}}/` | T3, T4 (`verify.py`, `session.py`) | `pytest tests/auth/test_integration.py -v` |

**Parallelism:** {{1}} task — no parallelism in this wave.

## Dependency Graph (DAG)

```
T1 ──→ T3 ──→ T5
           ↗
T2 ──→ T4 ──┘
```

## Task Inventory

| Task ID | Slug | Wave | Worktree | Branch | Task File |
|---------|------|------|----------|--------|-----------|
| {{T1}} | {{slug}} | 1 | `.worktrees/1-{{t1}}-{{slug}}/` | `agent/1-{{t1}}-{{slug}}` | `.plan/.../tasks/task-{{t1}}-{{slug}}.md` |
| {{T2}} | {{slug}} | 1 | `.worktrees/1-{{t2}}-{{slug}}/` | `agent/1-{{t2}}-{{slug}}` | `.plan/.../tasks/task-{{t2}}-{{slug}}.md` |
| {{T3}} | {{slug}} | 2 | `.worktrees/2-{{t3}}-{{slug}}/` | `agent/2-{{t3}}-{{slug}}` | `.plan/.../tasks/task-{{t3}}-{{slug}}.md` |
| {{...}} | ... | ... | ... | ... | ... |

## Execution Status

_Updated by the `execute` skill during execution._

| Task ID | Wave | Status | Started | Completed | Result |
|---------|------|--------|---------|-----------|--------|
| {{T1}} | 1 | ⬜ pending | — | — | — |
| {{T2}} | 1 | ⬜ pending | — | — | — |
| {{T3}} | 2 | ⬜ pending | — | — | — |
| {{T4}} | 2 | ⬜ pending | — | — | — |
| {{T5}} | 3 | ⬜ pending | — | — | — |

Statuses: ⬜ pending | 🟡 running | 🟢 passed | 🔴 failed
