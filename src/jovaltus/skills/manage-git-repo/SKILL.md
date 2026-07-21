---
name: manage-git-repo
description: >-
  Git repository management: structured commits and semantic version releases.

  Workflow A — commit: update project docs first, then split remaining changes
  into focused commits by change category (docs, feat, fix, refactor, chore).
  Each commit is self-contained and passes pre-commit checks.

  Workflow B — version-release: push all commits (if push access), identify
  version bump type (major/minor/patch) from commits, update every file that
  references the current version, bump changelog, create an annotated git tag.

  LOAD when:
  - User says "commit" / "release" / "version bump" / "提交" / "發布"
  - User wants structured git commits grouped by change type
  - User wants to create versioned releases with semver tags

  Do NOT use for:
  - Single-file quick commits (use git directly)
  - Release automation / CI pipeline setup
  - Creating releases without git (e.g. npm publish, PyPI upload)
author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [git, commit, release, semver, versioning, changelog, tag]
---

# Manage Git Repo

## Goal

Two independent workflows for git repo housekeeping:

- **Workflow A — Commit:** Stage and commit changes in logically grouped
  batches by change category. Documentation first, then refactors, then
  features/fixes, then tests. Every commit passes pre-commit hooks.

- **Workflow B — Version Release:** Determine semantic version bump from
  commit history, update all version references across the project, maintain
  a clean changelog, create an annotated git tag, and push (if permitted).

Workflows are independent — you can commit without releasing, or release an
already-committed state.

## Workflow A: Commit

### Acceptance Criteria

- Project documentation (AGENTS.md, CLAUDE.md, docs/) reviewed and updated first
- Changes grouped by category: docs, feat, fix, refactor, chore, test
- Each commit passes pre-commit hooks (lint, type-check, format)
- Commit messages follow conventional format: `<type>(<scope>): <description>`
- No `.env`, secrets, or generated files committed

### Step A.1: Verify Working Tree

```bash
git status
git diff --stat
```

Abort if there are no changes. Report what's staged vs unstaged.

### Step A.2: Update Project Documentation

Before committing code changes, review and update:
- `AGENTS.md` / `CLAUDE.md` — are build/test commands still correct?
- `docs/` — do any docs reference changed behaviour?
- `README.md` — any outdated information?

Apply documentation fixes. These become the first commit.

### Step A.3: Categorize Remaining Changes

For each changed file, classify:

| Category  | Prefix     | Examples                                      |
|-----------|------------|-----------------------------------------------|
| docs      | `docs:`    | README, AGENTS.md, docstrings, comments       |
| feat      | `feat:`    | New feature, new endpoint, new capability      |
| fix       | `fix:`     | Bug fix, error handling, edge case             |
| refactor  | `refactor:`| Restructure, rename, simplify (no behaviour change) |
| chore     | `chore:`   | Deps, config, CI, tooling, version bumps       |
| test      | `test:`    | Test additions or updates only                 |

### Step A.4: Commit in Groups

Commit each category as a separate commit. Order:
1. `chore:` / `docs:` first (foundation)
2. `refactor:` next
3. `feat:` / `fix:` next (the substance)
4. `test:` last

For each commit:
1. `git add <category-files>`
2. `git commit -m "<type>(<scope>): <description>"`
3. Verify pre-commit hooks pass. If they fail, fix and amend.

**Scope** is optional but recommended — use the module/component name
(e.g., `feat(auth): add OAuth2 login flow`).

### Step A.5: Final Verification

```bash
git log --oneline -n <number-of-new-commits>
git status   # must be clean
```

---

## Workflow B: Version Release

### Acceptance Criteria

- All local commits pushed to remote (if push access confirmed)
- Version bump type (major/minor/patch) identified from commit history
- Every file referencing the current version updated to the new version
- CHANGELOG updated with the new version entry
- Annotated git tag created: `v<new-version>`
- Tag pushed to remote (if push access)

### Core Principles

**Semantic versioning is strict:**
- **MAJOR** (`1.x` → `2.0`): breaking changes, API removals, major rewrites.
  Rare — most releases are minor or patch.
- **MINOR** (`1.x` → `1.x+1`): new features, new API surfaces, non-breaking
  enhancements. Default for feature work.
- **PATCH** (`1.x.y` → `1.x.y+1`): bug fixes, documentation, dependency
  bumps, internal refactors with zero behavioural change.

**Version references must be exhaustive.** When bumping, find every file that
mentions the current version string and update it. Common locations:
- `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`
- `plugin.yaml`, `__init__.py` `__version__`, `version.py`
- `CHANGELOG.md`, `README.md`, `docs/`

**push is opt-in.** Always confirm push access before `git push`. If the user
doesn't have remote push permissions, perform all local operations (commit,
tag, version bump) and report what would be pushed.

### Step B.1: Determine Bump Type

Read commits since the last tag:

```bash
git describe --tags --abbrev=0 2>/dev/null || echo "no previous tag"
git log <last-tag>..HEAD --oneline   # or all commits if no previous tag
```

Classify the bump:

| Commits contain...                            | Bump  |
|-----------------------------------------------|-------|
| BREAKING CHANGE, major refactor               | MAJOR |
| At least one `feat:`                          | MINOR |
| Only `fix:`, `docs:`, `chore:`, `refactor:`, `test:` | PATCH |

If uncertain, present the commits to the user and ask.

### Step B.2: Identify All Version References

Search for the current version string across the project:

```bash
# Find the current version (from package manifest or existing tag)
CURRENT=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//')
# Search for it everywhere
rg -l "$CURRENT" --type-not binary
```

Also search for version variables:

```bash
rg 'version\s*=\s*"' pyproject.toml package.json Cargo.toml 2>/dev/null
rg '__version__\s*=' --type py 2>/dev/null
rg '"version":' package.json 2>/dev/null
```

Map every file:line that needs updating. Distinguish:
- **Version declarations** (must update): `version = "0.6.0"` in
  `pyproject.toml`, `version: 0.6.0` in `plugin.yaml`
- **Historical descriptions** (do NOT update): `v0.6.0 rewrote...` in docs,
  changelog entries for past releases

Present the list to the user before editing.

### Step B.3: Update Version + Changelog

1. **Bump version in all identified files** — replace the old version string
   only in version declarations. For structured formats (`pyproject.toml`,
   `package.json`), update the `version` field. For `__version__` strings,
   update inline. Never touch historical descriptions.

2. **Update CHANGELOG** — prepend a new entry:

```markdown
## v<NEW_VERSION> — <YYYY-MM-DD>

### Added
- <new features from feat: commits>

### Changed
- <behavioural changes>

### Fixed
- <bug fixes from fix: commits>

[Full changelog](https://github.com/<org>/<repo>/compare/v<OLD>...v<NEW>)
```

Derive the changelog entries from `git log <old-tag>..HEAD --oneline`.

### Step B.4: Commit Version Bump

```bash
git add -A
git commit -m "chore(release): bump version to v<NEW_VERSION>"
```

### Step B.5: Create and Push Tag

```bash
git tag -a v<NEW_VERSION> -m "Release v<NEW_VERSION>"
```

Then confirm push access and push:

```bash
# Check remote
git remote -v

# If push access confirmed:
git push origin HEAD
git push origin v<NEW_VERSION>
```

If push access is unknown or denied, report: "Tag v<NEW_VERSION> created locally.
No remote push — push manually when ready."

### Step B.6: Final Report

Present a release summary:

```
## Release v<NEW_VERSION>

**Bump type:** <MAJOR|MINOR|PATCH> (<reason>)
**Commits:** <N> commits from v<OLD>
**Files updated:** <list>
**Tag:** v<NEW_VERSION> (annotated)
**Push:** ✅ pushed / ⚠️ local only
```

## Gotchas

- **Never commit secrets.** Before every commit, verify `.env`, `.env.local`,
  `credentials.json`, and similar files are in `.gitignore`. If they're
  accidentally staged, `git reset HEAD <file>` and check `.gitignore`.
- **Pre-commit hooks must pass.** If a hook fails, fix the issue and `git commit
  --amend`. Never skip hooks with `--no-verify` unless the user explicitly
  requests it for a specific, justified reason.
- **Version search must be exhaustive.** `rg "$VERSION"` alone misses structured
  formats where version appears in YAML/TOML/JSON fields keyed "version".
  Search both the literal string AND the version field patterns.
- **Semantic versioning is cumulative.** If `git log` shows 5 `feat:` commits
  and 3 `fix:` commits, the bump is MINOR (feat dominates). A release always
  takes the highest applicable bump level.
- **Don't update historical descriptions.** `"v0.6.0 rewrote the architecture"`
  in README.md is a historical fact, not a version declaration. Only update
  the actual version fields.
- **CHANGELOG is the release record.** Every release adds one section at the
  top. Never delete old entries. The changelog must tell the complete story
  of every version that shipped.
- **Empty commits are rejected.** If Workflow A has no changes, report it and
  skip. If Workflow B has no commits since the last tag, ask the user whether
  they intended to release without changes.
- **Push is a separate confirmation.** Even if `git remote -v` shows a remote,
  don't assume the user wants to push. Always confirm — especially for
  projects where the remote might be a fork or read-only mirror.
- **Tag names are always `v`-prefixed.** `v1.2.3`, not `1.2.3`. Consistent
  with Go modules, GitHub Releases, and 95% of the ecosystem.
