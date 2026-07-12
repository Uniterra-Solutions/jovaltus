---
name: project-documentation
description: >-
  Complete project documentation generator. Reads the entire codebase and
  creates a comprehensive docs/ tree: architecture with Mermaid diagrams,
  per-module deep dives, API reference, conventions, data models, setup guide,
  testing guide, and workflow recipes. Follows community best practices
  (CodeWiki, DocAgent, codedocs, agentic-docs): agent-first writing, tables
  over prose, one-home-per-fact, structured lookup maps, incremental update
  support, and verification auditing.

  LOAD when:
  - User asks to "document this project", "generate docs", "create project documentation"
  - User says "write comprehensive docs for this codebase"
  - User wants to onboard new team members and needs architecture / module docs
  - User asks "explain how this project works" or "what does this codebase do"
  - User wants to refresh or update existing docs after code changes

  DO NOT load when:
  - User asks for a single-file README.md update (use a general approach)
  - User asks about AGENTS.md or CLAUDE.md specifically (use manage-agents-md skill)
  - User wants a one-line project description or quick summary
  - The project is a trivial single-file script

author: LaiTszKin
version: 0.1.0
metadata:
  jovaltus:
    tags: [documentation, codebase-analysis, architecture, onboarding, agent-context]
---

# Project Documentation Generator

## Goal

Generate a comprehensive, structured `docs/` tree from any codebase by following
a disciplined 4-phase workflow. The output is agent-first documentation —
optimised for AI coding agents to consume, while remaining readable for humans.
Every fact has exactly one home, every diagram matches the code, and every
cross-reference resolves.

## Acceptance Criteria

- Tech stack auto-detected from config files (pyproject.toml, package.json, Cargo.toml, etc.)
- Complete `docs/` tree generated covering architecture, modules, API, conventions, data, setup, testing, workflows
- Mermaid architecture diagrams included (at minimum: system context + container view)
- All cross-references within `docs/` resolve (no broken links)
- Agent-first writing style: tables over prose, entries ≤ 5 lines or linked to source
- Incremental update mode: detect changed files via `git diff`, update only affected docs
- Verification audit passes: coverage check, link check, freshness check

## Core Principles

- **Agent-first writing.** Write for AI agents first, humans second. Tables over
  prose. Structural maps over narrative. Direct, imperative voice. No fluff.
- **One home per fact.** Each concept, module, endpoint, or pattern lives in exactly
  one file. Cross-reference with relative links — never duplicate.
- **Diagrams verify the text.** Every architecture diagram (Mermaid) must match
  the code it describes. If the code changes, the diagram changes in the same commit.
- **Docs are code artefacts.** Docs live in the repo, go through the same quality
  gates, and ship with the code they describe. No separate wiki rot.
- **Incremental over wholesale.** When code changes, update only the affected
  doc sections — never regenerate the entire tree from scratch unless explicitly
  asked.

---

## Workflow

### Phase 1: SCAN — Build the Project Inventory

**Goal:** Understand what the project IS before reading any code in detail.

Read these files in order (they exist in every well-structured project):

1. **Package manifest** — `pyproject.toml`, `package.json`, `Cargo.toml`, `go.mod`,
   `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `mix.exs` — whichever exists.
   Extract: project name, version, language, build system, key dependencies.

2. **Entry points** — `main.py`, `app.py`, `index.ts`, `src/main.rs`, `cmd/` —
   find where the application starts.

3. **Directory tree** — Top 2 levels of the source tree. Identify logical module
   boundaries (groups of related files in directories).

4. **Config files** — `.env.example`, `docker-compose.yml`, `Dockerfile`,
   `Makefile`, CI configs. Extract: environment vars, services, deployment shape.

5. **Test config** — `pytest.ini`, `jest.config.js`, `vitest.config.ts`,
   `.rspec`, test directory layout. Extract: test framework, runner command, patterns.

6. **Lint/format config** — `ruff.toml`, `.eslintrc`, `.prettierrc`, `clippy.toml`.
   Extract: style conventions enforced by tooling.

7. **Existing docs** — `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`,
   `docs/` directory. Extract: what's already documented, what's missing.

**Output:** A structured inventory document (kept in memory, not written to disk)
listing: tech stack, module map, entry points, external dependencies, config
surface, existing docs coverage, and a gap analysis.

### Phase 2: ANALYZE — Deep-Read Key Modules

**Goal:** Understand HOW the project works — dependencies, data flow, API surface.

For each logical module identified in Phase 1:

1. **Read the public surface** — exported functions, classes, routes, handlers.
   For Python: `__all__`, public function signatures. For TypeScript: `export`
   declarations. For Go: exported identifiers.

2. **Trace imports/dependencies** — what does this module import? What imports
   this module? Build a dependency graph.

3. **Extract API contracts** — route definitions, request/response shapes,
   error handling patterns, middleware/guards.

4. **Identify data models** — ORM models, schemas, types, interfaces, database
   migrations. Map entity relationships.

5. **Capture patterns** — recurring code shapes: error handling, auth checks,
   logging, configuration loading, async patterns, testing patterns.

6. **Note architectural decisions** — why is module X separate from Y? Why was
   library Z chosen? If the rationale is documented (ADRs, comments, commit
   messages), capture it. If not, flag it as `[INFERRED]`.

**Output:** Per-module analysis notes covering: purpose, public API, dependencies
(inbound + outbound), data models, patterns used, and architectural notes.

### Phase 3: GENERATE — Write the Documentation Tree

**Goal:** Transform analysis into structured, agent-first documentation.

Generate files in this dependency order (each file references earlier ones):

#### 3.1 `docs/tech-stack.md`
- Language (with version), runtime, package manager
- Key frameworks and libraries (with versions)
- Build system, test framework, linter/formatter
- Infrastructure: database, cache, queue, external services
- Table format: | Component | Version | Purpose |

#### 3.2 `docs/project-structure.md`
- Directory tree with 1-line responsibility per directory
- Module boundary map: which dir maps to which logical module
- Entry points and their roles
- Table format: | Directory | Responsibility | Key Files |

#### 3.3 `docs/architecture.md`
- System context diagram (Mermaid C4 Context): user → system → external services
- Container diagram (Mermaid C4 Container): web app, API, database, cache, queue
- Data flow description: how a request travels through the system
- Key architectural decisions (with rationale where known, `[INFERRED]` where guessed)
- Deployment topology (if detectable from Docker/k8s configs)

#### 3.4 `docs/conventions.md`
- Naming conventions (files, variables, functions, classes)
- Import ordering and organisation
- Error handling patterns
- Logging conventions
- Configuration management
- Testing conventions (file naming, fixture patterns, mock policy)
- Code style (only rules that differ from language defaults)

#### 3.5 `docs/modules/<name>.md` (one per module)
- Module purpose (1 sentence)
- Public API surface (functions, classes, routes — with signatures, not full bodies)
- Dependencies: what it imports (inbound), what imports it (outbound)
- Data models owned by this module
- Key patterns or gotchas
- Table format for API: | Function/Route | Signature | Description |

#### 3.6 `docs/api-reference.md` (for HTTP/web projects)
- Base URL, auth requirements
- All endpoints grouped by resource
- Table: | Method | Path | Auth | Request Body | Response | Description |

#### 3.7 `docs/data-models.md`
- Entity-relationship overview (Mermaid ER diagram)
- Per-entity: fields, types, constraints, relationships
- Database schema (tables, columns, indexes) if SQL
- Migration strategy (if detectable)

#### 3.8 `docs/setup.md`
- Prerequisites (language versions, system deps)
- Install command(s)
- Environment configuration (.env vars with descriptions)
- Database setup (migrations, seeds)
- Run command(s) — dev server, build, etc.
- Docker setup (if applicable)

#### 3.9 `docs/testing.md`
- Test framework and version
- Run command for full suite + single file
- Test directory layout and naming conventions
- Fixture/factory patterns
- Mock policy (what gets mocked, what doesn't)
- Coverage expectations

#### 3.10 `docs/workflows.md`
- Common development tasks as step-by-step recipes:
  - Adding a new API endpoint
  - Adding a new database model
  - Adding a new module
  - Running specific test suites
  - Deploying (if detectable)

#### 3.11 `docs/README.md` (Hub — generate LAST)
- Navigation table: | I want to... | Read... |
- Document index: link to every file in docs/
- Quick links: setup, architecture diagram, API reference
- "What is this project?" (2-3 sentence summary)

### Phase 4: VERIFY — Audit the Documentation

**Goal:** Prove the documentation is complete, correct, and current.

#### Coverage Check
- Every top-level source directory has a corresponding `docs/modules/<name>.md`
- Every public API function/route is documented
- Every data model entity appears in `docs/data-models.md`
- Flag uncovered areas in the audit report

#### Link Check
- Every cross-reference in `docs/` points to an existing file
- Run: `grep -rohP '\[.*\]\(\./[^)]+\)' docs/ | sort | uniq` — verify each target exists

#### Freshness Check
- Are any doc sections clearly stale? (referencing deleted files, old API shapes)
- Compare against git log: were there structural changes since the last doc update?
- Flag stale sections with specific fix suggestions

#### Quality Check
- Writing style: no fluff words ("in this document we will explore..."), no emojis
- Entry length: no prose paragraph exceeds 5 lines without a table or link
- Agent utility: does each file answer the "I want to X → look here" question?

#### Audit Report
Output a structured report: Coverage (pass/fail + gaps), Links (pass/fail +
broken refs), Freshness (pass/fail + stale sections), Quality (pass/fail +
style violations). Each failure includes a concrete fix suggestion.

---

## Incremental Update Mode

When the user says "update the docs" or docs already exist:

1. **Detect changes:** `git diff --name-only <baseline>..HEAD` (or `git diff --name-only`
   for uncommitted changes)

2. **Map changes to docs:** Use the dependency graph from Phase 2 to determine
   which doc sections are affected:
   - Changed `src/auth/` → update `docs/modules/auth.md`
   - Changed data model → update `docs/data-models.md`
   - Changed route definition → update `docs/api-reference.md`
   - New dependency added → update `docs/tech-stack.md`
   - Changed directory structure → update `docs/project-structure.md`

3. **Update only affected sections.** Re-read the changed source files. Update
   ONLY the doc sections that reference the changed code. Do NOT regenerate
   untouched sections.

4. **Re-verify** with a focused audit: link check on updated files, freshness
   check on changed modules.

---

## Writing Style Rules

See `references/writing-style-guide.md` for the full style guide. Core rules:

| Rule | Bad | Good |
|------|-----|------|
| No introductions | "In this document, we will explore the architecture of..." | "## Architecture" |
| Tables over prose | 3 paragraphs describing API endpoints | 3-column table: Method, Path, Description |
| Short entries | 15-line prose description of a module | "Handles user auth (login, logout, token refresh)" |
| Structural maps | Alphabetical file listing | "I want to add a route → `src/api/routes.ts`" |
| No fluff | "It's important to note that..." | Just state the fact |
| One home | Same fact in README.md AND architecture.md | Fact in architecture.md; README.md links to it |
| Source links | "The auth module handles authentication" | "Auth module (`src/auth/index.ts:1-50`): JWT middleware + login/logout" |

---

## Technology Detection

See `references/tech-stack-detection.md` for the full detection matrix. Quick reference:

| Config File | Language | Build/PM | Likely Framework |
|-------------|----------|----------|------------------|
| `pyproject.toml` | Python | uv / pip | FastAPI, Django, Flask |
| `package.json` | TypeScript/JS | npm / yarn / pnpm | React, Next.js, Express |
| `Cargo.toml` | Rust | cargo | Actix, Axum, Rocket |
| `go.mod` | Go | go modules | gin, echo, chi |
| `Gemfile` | Ruby | bundler | Rails, Sinatra |
| `composer.json` | PHP | composer | Laravel, Symfony |
| `pom.xml` / `build.gradle` | Java/Kotlin | Maven/Gradle | Spring Boot |

Always verify framework claims by reading actual imports — never trust the
config file alone. A `pyproject.toml` that lists both Flask and FastAPI needs
source-level confirmation.

---

## References

- `references/document-types.md` — Detailed specification for each document type
- `references/tech-stack-detection.md` — Full technology detection matrix
- `references/writing-style-guide.md` — Agent-first writing conventions with examples
- `references/audit-checklist.md` — Complete verification audit checklist

---

## Templates

- `templates/architecture.md.tmpl` — Architecture doc with Mermaid stubs
- `templates/module.md.tmpl` — Per-module documentation template
- `templates/api-reference.md.tmpl` — API reference template
- `templates/conventions.md.tmpl` — Conventions document template
- `templates/hub-readme.md.tmpl` — docs/ hub navigation template
