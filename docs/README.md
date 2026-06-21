# Project Documentation

This directory contains standardized project documentation.

## Categories

| Directory | Purpose | Audience |
|---|---|---|
| `features/` | What the system does (BDD from user perspective) | Product, QA, new developers |
| `architecture/` | How the system is designed (module boundaries, data flow) | Developers, architects |
| `principles/` | How code is written (conventions, patterns) | Developers |

## Maintenance Guide

### Evidence Traceability

Every documentation claim must be traceable to source code evidence (file path + line range). Claims that cannot be directly verified from code are marked with `[INFERRED]`.

### LLM Safety

When regenerating documentation with LLMs, only feed structured metadata (file lists, module boundaries, API signatures). Do not transmit full source code.

### Incremental Updates

When code changes, only regenerate affected doc sections. Use `git diff` to identify changed file scopes, then update only the `.md` files whose evidence is in those files.

### Drift Detection

Periodically (monthly or quarterly) compare docs against actual code. Fix drift in affected sections only — do not full-rewrite unless the module has been substantially redesigned.

## Related

- `CLAUDE.md` and `AGENTS.md` at project root contain cross-cutting constraints
- `docs/plans/` contains implementation plans (not product docs)
