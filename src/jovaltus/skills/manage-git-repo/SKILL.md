---
name: manage-git-repo
description: >-
  Structured git commits grouped by change category and semantic version
  releases with changelog + annotated tags. Use when user asks to commit,
  release, bump version, or 提交/發布. Do NOT use for single-file quick
  commits, CI/CD pipeline setup, or non-git releases (npm publish, PyPI).
author: LaiTszKin
version: 0.2.0
metadata:
  jovaltus:
    tags: [git, commit, release, semver, versioning, changelog, tag]
---

# Manage Git Repo

## Goal

Two independent workflows for git housekeeping:

- **Workflow A — Commit:** Group working-tree changes by category and commit
  them in logical order (docs → refactor → feat/fix → test). Every commit
  passes pre-commit hooks and uses conventional commit format.

- **Workflow B — Version Release:** Determine the semantic version bump from
  commit history, update every version reference across the project, maintain
  the changelog, create an annotated `v`-prefixed tag, and push if the user
  confirms push access.

Workflows are independent — commit without releasing, or release an
already-committed state.

## Core Principles

**Commit ordering is a dependency chain.** Documentation and chores go first
because they describe the current state; refactors come next because features
and fixes build on clean code; tests go last because they validate the
features/fixes above them. Chronological order is irrelevant — only logical
dependency matters.

**Cumulative semver — highest applicable bump wins.** A release containing five
`feat:` commits and three `fix:` commits is a MINOR bump (feat dominates fix).
A single BREAKING CHANGE forces MAJOR regardless of everything else.

**Push is opt-in.** Never push without explicit confirmation. A remote URL
proves the remote exists — it does not prove the user wants to push to it.
The remote could be a fork, a read-only mirror, or intentionally local work.

**Version references are declarations only.** Replace version strings in
structured fields (`pyproject.toml`, `package.json`, `plugin.yaml`,
`__version__`). Never touch historical prose like "v0.6.0 rewrote the
architecture" — those are historical facts, not version declarations.

## Workflow A: Commit

### A.1 — Check for changes

Abort if the working tree has no changes. Report what's staged vs unstaged.

### A.2 — Update documentation first

Before committing code, review and update:
- `AGENTS.md` / `CLAUDE.md` — build/test commands still accurate?
- `docs/` — any references to behaviour that changed?
- `README.md` — outdated information?

Apply fixes. This becomes the first commit — documentation describes what
exists, so it must be current before any code changes land.

### A.3 — Categorize remaining changes

Classify each changed file by its *primary purpose*:

| Category  | Prefix     | When to use                                    |
|-----------|------------|------------------------------------------------|
| docs      | `docs:`    | Documentation, docstrings, comments            |
| feat      | `feat:`    | New feature, endpoint, or capability           |
| fix       | `fix:`     | Bug fix, error handling, edge case             |
| refactor  | `refactor:`| Restructure, rename, simplify (no behaviour change) |
| chore     | `chore:`   | Dependencies, config, CI, tooling              |
| test      | `test:`    | Test additions or updates only                 |

### A.4 — Commit in dependency order

1. `chore:` / `docs:` — foundation
2. `refactor:` — clean structure
3. `feat:` / `fix:` — substance
4. `test:` — validation

For each group: stage the files, write a conventional commit message with
optional scope (`feat(auth): add OAuth2 login`), and verify pre-commit hooks
pass. Fix and amend if hooks fail — never skip with `--no-verify` unless the
user explicitly requests it.

### A.5 — Final check

Review the new commits and confirm the working tree is clean.

---

## Workflow B: Version Release

### B.1 — Determine bump type

Read commits since the last tag. Classify the bump:

| Commits contain...                   | Bump  |
|--------------------------------------|-------|
| BREAKING CHANGE, major API removal   | MAJOR |
| At least one `feat:`                 | MINOR |
| Only `fix:`, `docs:`, `chore:`, etc. | PATCH |

Semver is strict: MAJOR for breaking changes; MINOR for any new feature;
PATCH for fixes, docs, deps, and internal-only changes. When uncertain,
present the commits and ask the user.

### B.2 — Find all version references

Use a two-pronged search:

1. **Literal string** — search the current version number across the project.
   Catches inline references in README, docs, and config.
2. **Structured fields** — search for `version =` in TOML/JSON, `__version__`
   in Python, `version:` in YAML. Catches declarations that differ from the
   literal string format.

For each match, classify: **declaration** (must update) vs **historical
reference** (must NOT touch). Present the list before editing.

### B.3 — Update version + changelog

1. **Bump version files** — replace the old version only in declarations.
2. **Update CHANGELOG** — prepend an entry derived from `git log`:

   ```markdown
   ## v<NEW> — <YYYY-MM-DD>
   ### Added
   - <features from feat: commits>
   ### Changed
   - <behavioural changes>
   ### Fixed
   - <fixes from fix: commits>
   ```

   Include a full-changelog comparison link if the project has a GitHub URL.
   Never delete old entries — the changelog is the complete release record.

### B.4 — Commit and tag

Commit the version bump as `chore(release): bump version to v<NEW>`.
Create an annotated tag: `v<NEW>` — always `v`-prefixed.

### B.5 — Push (conditional)

Confirm push access with the user, then push branch + tag. If push is denied
or uncertain, complete all local operations and report what would be pushed.

### B.6 — Summary

Report: bump type + reason, commit count, files updated, tag name, push status.

## Gotchas

- **Cumulative semver is absolute.** A single `feat:` anywhere in the commit
  range forces MINOR — even if every other commit is a fix.
- **Historical version references must survive.** "v0.6.0 introduced X" in
  docs stays forever. Update only structured version declarations.
- **`v`-prefix is mandatory.** Tags are `v1.2.3`, never `1.2.3`.
- **Empty state is an error, not a no-op.** If Workflow A finds no changes,
  stop and report it. If Workflow B finds no commits since the last tag, ask
  whether the user intended to release.
- **Secrets check before every commit.** Verify `.env`, `.env.local`,
  `credentials.json` are in `.gitignore`. If a secret file is accidentally
  staged, unstage it and fix `.gitignore` — never proceed with secrets in the
  index.
- **Pre-commit hooks are blocking.** Never skip hooks with `--no-verify`
  unless the user explicitly requests it with justification.
