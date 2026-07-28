---
name: manage-git-repo
description: >-
  Git repository management: commit changes, bump versions, create
  semantic-version releases with changelogs and annotated tags, push
  to remotes, create semantic branches, batch-commit, and open pull
  requests. Use when the user asks to commit, push, tag, release,
  bump a version, write a changelog, manage a git repository, create
  a branch from changes, open a PR (提交, 發布, 推送, 版本, 標籤,
  合併, PR, git). NOT for: single-file quick commits, CI/CD pipeline
  setup, or non-git releases (npm publish, PyPI, Docker).
  
author: LaiTszKin
version: 0.3.0
metadata:
  jovaltus:
    tags: [git, commit, release, semver, versioning, changelog, tag, branch, pr, pull-request]
---

# Manage Git Repo

## Goal

Three independent workflows for git housekeeping:

- **Workflow A — Commit:** Group working-tree changes by category and commit
  them in logical order (docs → refactor → feat/fix → test). Every commit
  passes pre-commit hooks and uses conventional commit format.

- **Workflow B — Version Release:** Determine the semantic version bump from
  commit history, update every version reference across the project, maintain
  the changelog, create an annotated `v`-prefixed tag, and push if the user
  confirms push access.

- **Workflow C — Branch + Batch Commit + PR:** Create a semantic branch from
  current changes, batch-commit them using Workflow A's categorization, push
  the branch, and open a pull request. Use when the user says "create a PR,"
  "開 PR," "提交 PR," or asks to branch/commit/PR in one flow.

Workflows are independent — commit without releasing, release an
already-committed state, or branch+PR without releasing.

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

---

## Workflow C: Branch + Batch Commit + PR

### C.1 — Pre-flight checks

1. **Auth check** — verify GitHub authentication (see `github-auth` skill):
   ```bash
   if command -v gh &>/dev/null && gh auth status &>/dev/null; then
     AUTH="gh"
   elif [ -n "$GITHUB_TOKEN" ]; then
     AUTH="curl"
   elif _hermes_env="${HERMES_HOME:-$HOME/.hermes}/.env"; [ -f "$_hermes_env" ] && grep -q "^GITHUB_TOKEN=" "$_hermes_env"; then
     export GITHUB_TOKEN=$(grep "^GITHUB_TOKEN=" "$_hermes_env" | head -1 | cut -d= -f2 | tr -d '\n\r')
     AUTH="curl"
   else
     echo "ABORT: no GitHub auth found. Run github-auth skill first."
     exit 1
   fi
   ```

2. **Clean index check** — if there are staged changes, ask the user whether to
   include them or unstage first. Uncommitted work is the payload for this
   workflow — it should not be mixed with pre-existing staged changes unless
   intended.

3. **Working tree check** — abort if the working tree has no changes.
   Report what's staged vs unstaged.

4. **Base branch** — identify the default branch (`main` or `master`) and
   ensure it's up to date:
   ```bash
   DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep "HEAD branch" | awk '{print $NF}' || echo "main")
   git fetch origin
   ```

### C.2 — Determine branch name from changes

Analyze the changed files to determine the dominant change category and
construct a semantic branch name:

1. **Classify** each changed file using the same categories as Workflow A
   (docs, feat, fix, refactor, chore, test). Count occurrences.

2. **Determine the prefix** — the highest-priority category wins:
   `feat` > `fix` > `refactor` > `docs` > `chore` > `test`

3. **Derive a slug** from the change content:
   - Read changed files to extract the primary subject (e.g., a module name,
     feature name, or the bug being fixed)
   - Convert to lowercase, replace spaces/special chars with hyphens
   - Keep it short (2–4 words max)

4. **Assemble** the branch name: `<prefix>/<slug>`
   - Examples: `feat/oauth2-login`, `fix/redirect-loop`, `refactor/auth-module`,
     `docs/api-reference`

5. **Present** the proposed branch name to the user for confirmation before
   creating it. If the user rejects, ask for their preferred name.

### C.3 — Create and switch to branch

```bash
git checkout -b <branch-name>
```

Branch from the current HEAD (which should be the up-to-date default branch
from C.1). If the branch name already exists locally, append a numeric suffix
(e.g., `feat/oauth2-login-2`). If it exists on the remote, abort and ask.

### C.4 — Batch-commit changes (Workflow A)

Now apply Workflow A in full on the new branch:

1. **Update documentation first** (A.2) — review AGENTS.md, docs/, README.md
   for accuracy against the current changes. Commit as `docs:` or `chore:`.

2. **Categorize remaining changes** (A.3) — classify every changed file.

3. **Commit in dependency order** (A.4):
   1. `chore:` / `docs:` — foundation
   2. `refactor:` — clean structure
   3. `feat:` / `fix:` — substance
   4. `test:` — validation

   Each commit must pass pre-commit hooks. Fix and amend if hooks fail — never
   skip with `--no-verify` unless the user explicitly requests it.

4. **Final check** (A.5) — confirm the working tree is clean and review the
   commit log.

### C.5 — Push the branch

```bash
git push -u origin HEAD
```

If push is denied (permission, protected branch), report the error and stop.
Do not force-push unless the user explicitly requests it.

### C.6 — Create the pull request

**Determine base branch** — use the default branch from C.1 unless the user
specified a different target.

**Build the PR body** from the commit history on the branch:

```bash
# Generate a summary from commits since branching point
git log --oneline $DEFAULT_BRANCH..HEAD
```

The PR body should include:
- **Summary** — one-paragraph description of what this PR does
- **Changes** — bullet list derived from commit messages
- **Test plan** — how to verify the changes (derive from test commits or ask
  the user)

**With gh:**

```bash
gh pr create \
  --title "<type>: <short description>" \
  --body "<PR body>" \
  --base "$DEFAULT_BRANCH"
```

Add `--draft` if the user wants a draft PR. Add `--reviewer <user1>,<user2>`
if reviewers are specified. Add `--label "<label>"` for labels.

**With git + curl:**

Extract owner/repo from the remote:
```bash
REMOTE_URL=$(git remote get-url origin)
OWNER_REPO=$(echo "$REMOTE_URL" | sed -E 's|.*github\\.com[:/]||; s|\\.git$||')
BRANCH=$(git branch --show-current)
```

Then:
```bash
curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$OWNER_REPO/pulls" \
  -d "{
    \"title\": \"<type>: <short description>\",
    \"body\": \"<PR body>\",
    \"head\": \"$BRANCH\",
    \"base\": \"$DEFAULT_BRANCH\"
  }"
```

Save the PR URL from the response and report it to the user.

### C.7 — Summary

Report:
- Branch name created
- Number of commits and their types
- PR URL (or PR number if gh)
- Whether the PR is a draft
- Base branch targeted

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
- **Workflow C — branch naming must be semantic.** The branch prefix reflects
  the dominant change category, not the user's mood or a ticket number alone.
  `feat/`, `fix/`, `refactor/`, `docs/`, `chore/` are the only valid prefixes.
- **Workflow C — branch from clean default.** Always branch from an up-to-date
  default branch. Branching from a stale main or a feature branch produces
  merge conflicts and confusing diffs.
- **Workflow C — PR body is derived from commits.** The commit messages are
  the canonical change log for the PR. If the commits don't tell a clear story,
  rebase and reword them before opening the PR — don't paper over messy commits
  with a hand-written PR body.
- **Workflow C — push is always opt-in for the PR step.** Pushing the branch
  (C.5) is automatic because the user asked to create a PR. But the PR creation
  itself (C.6) should confirm the title and base branch before firing.
