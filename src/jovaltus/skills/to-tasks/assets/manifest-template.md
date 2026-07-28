# Task Manifest: {{plan-name}}

> **Generated:** {{timestamp}} | **Plan:** `.plan/{{DD-MM-YYYY}}/{{name}}/`
> **Mode:** {{parallel | batch}} | **Total tasks:** {{N}} | **Batches:** {{1, or N for batch mode}}
> **Execution:** {{All tasks dispatch in parallel (fully parallel mode) | Tasks within each batch dispatch in parallel; batches run sequentially (batch mode)}}

---

## Mode: {{parallel | batch}}

{{If parallel: All tasks own disjoint files. Zero shared write targets. All can run simultaneously.}}
{{If batch: Tasks grouped into sequential batches. Within each batch, tasks are parallel-safe. Between batches, later batches depend on earlier batches' output. Execute batches in order: complete batch N → merge → dispatch batch N+1.}}

---

## Task Inventory

{{For fully parallel mode — no Batch or Depends On columns:}}

| Task ID | Slug | Owns Tests | Task File | Worktree | Branch | Verification |
|---------|------|------------|-----------|----------|--------|-------------|
| {{T1}} | {{slug}} | ✅ | `.plan/.../tasks/task-{{t1}}-{{slug}}.md` | `.worktrees/{{t1}}-{{slug}}/` | `agent/{{t1}}-{{slug}}` | `pytest tests/... -v` |
| {{T2}} | {{slug}} | ✅ | `.plan/.../tasks/task-{{t2}}-{{slug}}.md` | `.worktrees/{{t2}}-{{slug}}/` | `agent/{{t2}}-{{slug}}` | `pytest tests/... -v` |
| {{T3}} | {{slug}} | ✅ | `.plan/.../tasks/task-{{t3}}-{{slug}}.md` | `.worktrees/{{t3}}-{{slug}}/` | `agent/{{t3}}-{{slug}}` | `pytest tests/... -v` |
| {{...}} | ... | ... | ... | ... | ... | ... |

{{For batch mode — includes Batch and Depends On columns:}}

| Task ID | Batch | Slug | Owns Tests | Depends On | Task File | Worktree | Branch | Verification |
|---------|-------|------|------------|------------|-----------|----------|--------|-------------|
| {{T1}} | 1 | {{slug}} | ✅ | — | `.plan/.../tasks/task-{{t1}}-{{slug}}.md` | `.worktrees/{{t1}}-{{slug}}/` | `agent/{{t1}}-{{slug}}` | `pytest tests/... -v` |
| {{T2}} | 1 | {{slug}} | ✅ | — | `.plan/.../tasks/task-{{t2}}-{{slug}}.md` | `.worktrees/{{t2}}-{{slug}}/` | `agent/{{t2}}-{{slug}}` | `pytest tests/... -v` |
| {{T3}} | 2 | {{slug}} | ✅ | T1, T2 | `.plan/.../tasks/task-{{t3}}-{{slug}}.md` | `.worktrees/{{t3}}-{{slug}}/` | `agent/{{t3}}-{{slug}}` | `pytest tests/... -v` |
| {{T4}} | 2 | {{slug}} | ✅ | T1 | `.plan/.../tasks/task-{{t4}}-{{slug}}.md` | `.worktrees/{{t4}}-{{slug}}/` | `agent/{{t4}}-{{slug}}` | `pytest tests/... -v` |
| {{...}} | ... | ... | ... | ... | ... | ... | ... | ... |

---

## File Ownership Map

_Every file belongs to exactly one task per batch. Every test file owned by the same task as its implementation. {{For fully parallel: Zero overlap proves parallel-safe execution. For batch: Zero overlap within each batch; cross-batch overlaps are documented below.}}_

| File | Owner | Batch | Action |
|------|-------|-------|--------|
| `src/auth/register.py` | {{T1}} | {{1 or —}} | CREATE |
| `src/auth/login.py` | {{T2}} | {{1 or —}} | CREATE |
| `src/auth/__init__.py` | {{T1}} | {{1 or —}} | EDIT |
| `src/auth/jwt.py` | {{T1}} | {{1 or —}} | CREATE |
| `src/models/user.py` | {{T3}} | {{1 or —}} | CREATE |
| `tests/auth/test_register.py` | {{T1}} | {{1 or —}} | CREATE |
| `tests/auth/test_login.py` | {{T2}} | {{1 or —}} | CREATE |
| `tests/models/test_user.py` | {{T3}} | {{1 or —}} | CREATE |
| {{...}} | ... | ... | ... |

**Validation:** {{N}} files, {{N}} unique write owners per batch → ✅ zero write conflicts within each batch.
**Test bundling:** {{K}} test files, all owned by same task as their implementation → ✅ tests never split.

{{For batch mode only — cross-batch file overlaps:}}

### Cross-Batch File Overlaps

_Later batches intentionally edit files created or modified by earlier batches. These overlaps are safe because batches execute sequentially._

| File | Batch 1 Owner | Batch 2 Owner | Notes |
|------|---------------|---------------|-------|
| `src/models/user.py` | T1 (CREATE) | T3 (EDIT — add fields) | T3 extends the schema T1 created |
| {{...}} | ... | ... | ... |

---

## Batch Dependency Graph (batch mode only)

```
Batch 1 (Foundation)
  T1: {{core-types}} ─────┐
  T2: {{db-schema}} ──────┤
                           ▼
Batch 2 (Features)        │
  T3: {{feature-a}} ◄─────┤ (depends on T1, T2)
  T4: {{feature-b}} ◄─────┘ (depends on T1)

Batch 3 (Integration)
  T5: {{integration}} ◄─── T3, T4
```

**Dependency chain:** acyclic ✅ | **Batch 1 dependencies:** none (foundation) ✅

---

## Execution Status

_Updated by the `execute` skill during execution._

{{Fully parallel mode:}}

| Task ID | Status | Started | Completed | Result |
|---------|--------|---------|-----------|--------|
| {{T1}} | ⬜ pending | — | — | — |
| {{T2}} | ⬜ pending | — | — | — |
| {{T3}} | ⬜ pending | — | — | — |
| {{...}} | ⬜ pending | — | — | — |

{{Batch mode:}}

| Task ID | Batch | Status | Started | Completed | Result |
|---------|-------|--------|---------|-----------|--------|
| {{T1}} | 1 | ⬜ pending | — | — | — |
| {{T2}} | 1 | ⬜ pending | — | — | — |
| {{T3}} | 2 | ⬜ pending | — | — | — |
| {{T4}} | 2 | ⬜ pending | — | — | — |
| {{...}} | ... | ... | ... | ... | ... |

Statuses: ⬜ pending | 🟡 running | 🟢 passed | 🔴 failed
