---
name: jovaltus
description: >-
  Universal entry point for ALL software engineering tasks — always trigger
  first. From one-line fixes to full feature builds: the skill internally
  classifies the task and routes to direct implementation (trivial changes),
  a utility skill (debugging, docs, git, agent config), or the Jovaltus
  pipeline (discuss → design → to-spec → to-tasks → execute
  → simplify → review → qa). Trigger on ANY code-related request: build,
  create, implement, add, remove, rename, fix, debug, refactor, change,
  update, write, edit, commit, release, document, 開發, 幫我做, 寫, 改,
  加功能, 修復, 提交, 發布, 寫文檔. Never skip this skill for software
  engineering work — it decides the routing, not the model.
---

# Jovaltus — Core Router

## Goal

Route the user to the correct Jovaltus entry point based on what they want
to accomplish. Three destinations: Direct Change (just do it), Utility Skill
(standalone workflow), or Pipeline (phased planning → building → verifying).

Skip phases whose outputs are already present in the prompt — don't redo work
the user has already done.

## Acceptance Criteria

- Triage decision (Direct / Utility / Pipeline) made in one pass — no back-and-forth
- For Direct: change applied immediately, no documents created
- For Utility: target skill identified and loaded, no pipeline phases invoked
- For Pipeline: entry point determined, user confirmed before proceeding
- PRD and design.md written non-interactively when inputs are already complete
- User reviews each document before the pipeline continues
- Uncertain classification → default to Pipeline (conservative fallback)

## Core Principles

**Respect preparation. Confirm before skipping. When in doubt, start earlier.**

If the user already did the thinking, don't redo it. Interactive questioning
is for gaps — not a ritual. Always tell the user what you detected and which
phase or skill you're routing to; let them correct. A conservative classification
(one extra confirmation round) costs less than an aggressive one (rewriting
a design doc the user already had in mind).

## Phase 0: Triage — Three Buckets

**This is the most important decision.** Classify into one of three buckets.
If uncertain, default to Pipeline (Bucket 3).

### Bucket 1: Direct Change — just do it

The change is trivial AND unambiguous. Describe the entire change in one
sentence with no missing information. No skill loaded, no pipeline, no documents.

| Signal | Examples |
|---|---|
| Bug fix with known root cause | "Fix the off-by-one in `paginate()` at line 42" |
| Rename a symbol | "Rename `getUser` to `get_user` in `auth.py`" |
| Fix lint/type/format error | "Fix the mypy error on line 15" |
| One-line or single-expression change | "Change the default timeout from 30 to 60" |
| Config change (one field) | "Add `pool_size=10` to the DB config" |
| Simple refactor (extract helper) | "Extract the retry loop into `retry_with_backoff()`" |
| Add a test for existing code | "Add a unit test for the edge case in `parse_date`" |
| User says "just do it" / "直接改" / "不用走流程" | Obey immediately |

**If Direct:** Tell the user 「這是 direct change，不用走 pipeline，直接改。」
Then proceed — no documents, no phases, no confirmations.

### Bucket 2: Utility Skill — standalone workflow

The task matches a bundled non-pipeline skill. Load that skill directly and
follow its workflow. No pipeline documents, no discuss/design phases.

| Skill | When to use | NOT for |
|---|---|---|
|| **agentic-debugging** | Bug, error, crash, exception, test failure, regression, "not working", "broken", unexpected behavior, wrong results. The agent drives debugging autonomously — reproduces, locates, fixes, verifies. | Feature requests, greenfield development, code review, or assisting a human who drives debugging |
|| **manage-agents-md** | Create/audit/update project convention files for AI agents: AGENTS.md, CLAUDE.md, .cursorrules, .windsurfrules. Use when updating project rules, coding guidelines, or agent context (更新項目規範、coding rules). | README.md, CONTRIBUTING.md, docs/ content, general project documentation |
|| **project-documentation** | Generate a full structured docs/ tree from a codebase. User asks to document a project, write documentation, create project wiki. Produces architecture diagrams, module deep-dives, API reference, conventions, setup/testing guides. | Single README updates, one-line summaries, AGENTS.md generation, trivial single-file scripts |
|| **manage-git-repo** | Manage git repository actions: commit changes (grouped by category), bump versions, create semantic-version releases with changelogs and annotated tags, push to remotes. Use when committing, releasing, tagging, or managing git operations (commit、release、管理 git repo). | Single-file quick commits (use Direct), CI/CD pipeline setup, non-git releases (npm publish, PyPI, Docker) |

**If Utility:** Tell the user which skill matches and why, load
`skill_view(name='<skill>')`, then follow that skill's workflow. Skip
both Direct and Pipeline.

### Bucket 3: Pipeline — phased planning → building → verifying

Any change that is NOT in Bucket 1 or Bucket 2. Heuristics:

- New features or capabilities
- Multi-file changes (>2 files)
- Architecture or API design changes
- Data model changes
- >50 lines of new code
- Unknown root cause (needs investigation first)
- User explicitly asks to plan/design/spec
- **Uncertain → Pipeline** (conservative default)

**If Pipeline:** Continue to Phase 1.

## Phase 1: Scan the Prompt

Don't ask questions yet. Read the prompt and count how many domains the user
covered with **concrete, specific detail** — not passing mentions.

The Jovaltus pipeline: `discuss → design → to-spec → to-tasks
→ execute → simplify → review → qa`. Each phase reads the previous phase's
document, produces its own artifact, and hands off. Documents are the contract
between phases — no conversation history needed.

**Requirement signals** (8 domains from `discuss`):
Who & Why · Core Features · Data & Entities · User Journeys · Integrations ·
Non-functional (load, security, i18n) · Constraints (tech, deadline, platform) ·
Edge Cases (failure modes, empty states, concurrency)

**Technical-plan signals** (10 domains from `design`):
Architecture (system shape, sync/async) · Tech Stack (with rationale) ·
Data Model (fields + types + constraints) · API Design (style, endpoints, auth) ·
Components (module boundaries, interfaces) · Data Flow (write/read paths, events) ·
Auth & Security (mechanism, data protection) · Error Handling (retry, circuit breakers) ·
Infrastructure (hosting, CI/CD, monitoring) · Non-functional (caching, load numbers)

## Phase 2: Classify

```
req ≥ 5, tech ≥ 5  →  LEVEL 3: write PRD + design.md → review → to-spec
req ≥ 5, tech ≤ 4  →  LEVEL 2: write PRD → review → design
req ≤ 4            →  LEVEL 1: load discuss
```

Also check `.plan/<DD-MM-YYYY>/<name>/` — if `prd.md` or `design.md` already
exists, skip writing it (handles resume-after-interruption).

## Phase 3: Confirm

Tell the user what you found (match conversation language):

> 你已覆蓋需求的 X/8 領域，技術方案 Y/10 領域。我建議由 **Z** 開始。OK？

Wait for confirmation. If they disagree, adjust.

## Phase 4: Execute

**Level 1 — Vague idea:** Load `discuss` skill, follow its workflow.

**Level 2 — Write PRD directly:**
1. Map every concrete statement in the prompt to the 8 requirement domains.
2. For gaps: ask ONE targeted question per gap. Don't redo full discuss.
3. Write `.plan/<DD-MM-YYYY>/<name>/prd.md` using `discuss`'s template.
4. Present → user approves → "Ready for technical design?" → load `design`.

**Level 3 — Write PRD + design.md directly:**
1. Write PRD first (same as Level 2). Don't write design until PRD is approved.
2. Map every technical decision to the 10 design domains. Fill gaps with
   reasonable defaults — flag as "Agent proposed — please review."
3. Write `.plan/<DD-MM-YYYY>/<name>/design.md` using `design`'s template.
4. Present → user approves → "Ready for implementation specs?" → load `to-spec`.

## Phase 5: Continue

After the entry point, the remaining pipeline phases run sequentially. After
each phase, offer the natural next step. No further routing needed.

## Pipeline Fast-Path Rules

Override normal pipeline-phase classification when the signal is unambiguous
(these apply AFTER Phase 0 has decided "Pipeline"):

- **User provides a PRD file/link** → verify, ask: design or to-spec next?
- **User provides PRD + design doc** → skip to to-spec
- **One-sentence prompt** ("I want a todo app") → don't count domains, load discuss
- **User says "just build it" with file paths + stack + acceptance criteria**
  → check if it maps to spec format; if yes, offer to-tasks

## Pipeline Phase Reference

After the entry point is confirmed and the pipeline is running, here is when
each phase skill should be loaded:

| Phase | Skill | When loaded | What it produces |
|---|---|---|---|
| Requirements | `discuss` | Vague idea, Level 1, or gaps in prompt | `.plan/<date>/<name>/prd.md` |
| Technical Design | `design` | PRD approved, Level 2/3 next step | `.plan/<date>/<name>/design.md` |
| Implementation Spec | `to-spec` | Design approved | `.plan/<date>/<name>/spec.md` |
| Task Decomposition | `to-tasks` | Spec approved | `.plan/<date>/<name>/tasks.md` (manifest with task DAG) |
| Implementation | `execute` | Tasks ready (DAG manifest) | Worktrees + DAG-ordered code changes per task |
| Simplification | `simplify` | Code implemented | Simplified code (behaviour preserved) |
| Review | `review` | Code simplified | Review report + fixes |
| QA | `qa` | Review passed | QA report + fixes + regression tests |

## Utility Skill Reference

These skills handle standalone workflows outside the pipeline. When Bucket 2
matches, load the skill directly — no pipeline documents, no phase sequencing.

| Skill | Use when user says... | Core workflow |
|---|---|---|
| `agentic-debugging` | "這個有 bug" / "fix the crash" / "test is failing" / "不 work" / "行為不對" | Reproduce → Locate → Hypothesize → Fix → Verify. Bounded to 3 loop iterations; Rule of Three escalation for structural bugs. Also applies to unexpected behavior (非預期行為). |
| `manage-agents-md` | "create AGENTS.md" / "audit project rules" / "update .cursorrules" / "更新項目規範" | Scan project → write 6-section file → self-audit → drift-check every command. Handles AGENTS.md, CLAUDE.md, .cursorrules, .windsurfrules. |
| `project-documentation` | "generate docs for this project" / "幫我寫文檔" / "document the codebase" | Scan → Analyze (deep-read modules) → Generate 11-file docs/ tree → Verify with audit. Supports incremental git-diff updates. |
| `manage-git-repo` | "commit" / "push" / "release" / "bump version" / "tag" / "changelog" / "管理 git repo" | Two independent workflows: Commit (group → order → pre-commit → verify) and Release (determine bump → update versions → changelog → tag → push with confirmation). |

## Gotchas

- **Domain count is a heuristic, not a contract.** 5 superficial domains <
  3 deeply detailed ones. Quality > quantity. Err on the side of asking.
- **"I already know what I want" but prompt is vague.** One gentle probe:
  "Who will use this and what are the core features?" Then classify.
- **Templates live in target skills, not here.** Load via
  `skill_view(name='discuss', file_path='assets/prd-template.md')`.
- **This skill routes — it doesn't replace discuss or design.** After routing,
  load the target skill and follow its acceptance criteria.
- **Don't jump ahead without user approval.** Every document must be reviewed
  before the pipeline continues. The user is the gate.
- **Use `<DD-MM-YYYY>` for dates, lowercase-hyphens for project name slugs.**
- **Utility skills are standalone.** Don't route a debugging task through the
  pipeline just because the bug is in a feature. If the primary ask is "fix X"
  and X is broken, use `agentic-debugging`. Only route through the pipeline
  when the user is asking to build or plan something new.
- **Git operations are Direct or Utility, never Pipeline.** A single-file
  commit is Direct (Bucket 1). A multi-commit release with version bump is
  `manage-git-repo` (Bucket 2). Neither belongs in the pipeline.
- **Documentation is Utility, not Pipeline.** "Write docs for this project"
  loads `project-documentation`. "Update README with new endpoint" is Direct.
  The pipeline is for building features, not documenting existing code.
