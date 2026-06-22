# Project Documentation

This directory contains the standardized project documentation for Jovaltus.

## Directory Layout

- `docs/features/` — User-visible behavior described in BDD form.
- `docs/architecture/` — Macro-level design principles and module boundaries.
- `docs/principles/` — Recurring code-level conventions and constraints.

## Maintenance Guidance

### Evidence Traceability

Every claim in these documents must be traceable to a source file and line range. If a claim cannot be directly verified from the code, mark it with `[INFERRED]` and explain the basis of the inference.

### LLM Safety

When updating documentation with LLM assistance, feed only structured metadata — file lists, module boundaries, API endpoints, function signatures, dependency graphs — rather than full source code bodies.

### Incremental Updates

When code changes, use `git diff` to identify affected areas and update only the relevant document sections. Do not regenerate the entire documentation set for a localized change.

### Drift Detection

Review these documents periodically against the codebase. When drift is found, patch the affected sections instead of rewriting whole files.
