# Design: Agent Runtime Foundation

- **Date**: 2026-06-21
- **Feature**: Agent Runtime Foundation
- **Source SPEC**: `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`

> **Purpose:** Technical design document — defines architecture, external dependencies, data flow, invariants, and trade-offs. Provides technical decision basis for the `plan` phase's PROMPT.md.

---

## 1. Research Summary

### 1.1 Technical Feasibility

| Requirement | Feasibility | Risk |
|---|---|---|
| Req 1 | Feasible | Current registry lists and retrieves by id, but selection by name is not yet exposed. |
| Req 2 | Feasible | Current read tool uses Node file I/O and marks read state after successful reads. |
| Req 3 | Feasible | Current write/edit tools enforce read-before-write against existing files. |
| Req 4 | Feasible | Current bash tool uses Node child process execution with cwd, timeout, max buffer, and abort support. |
| Req 5 | Feasible | Current context composer returns memory, skills, tools, and MCP sections, but lacks dedicated context tests. |

**Overall assessment**: All feasible.

### 1.2 Existing Reference Implementations

| Source | Reusable Design Patterns |
|---|---|
| Node.js `node:fs/promises` documentation | Promise-based `readFile`, `writeFile`, and `mkdir` support the local file tools without new dependencies. |
| Node.js `node:child_process` documentation | Child-process execution supports cwd, timeout, output capture, and process termination semantics needed by the bash tool. |
| Vitest documentation | Existing repo test stack supports focused unit and integration-style tests for registry behavior, file tools, bash behavior, and context composition. |

### 1.3 Tech Stack Compatibility

| Candidate | Repo Dependency Compatibility | License | Decision |
|---|---|---|---|
| Node built-in `node:fs/promises`, `node:path`, `node:fs`, `node:child_process` | Compatible with current TypeScript ESM package setup and existing code. | Node.js license | Recommended; no dependency change. |
| Vitest | Already present in root devDependencies and configured for `packages/**/*.test.ts`. | MIT | Recommended for verification. |
| New third-party shell/file library | Not needed. | Varies | Rejected to keep the foundation small and dependency-free. |

## 2. Architecture Overview

### 2.1 Module List

| Module Key | Responsibility (one sentence) | Owned Artifacts (types, tables, queues) |
|---|---|---|
| `tools/types` | Defines public tool metadata, schemas, handlers, execution context, structured results, and registry contracts. | `Tool`, `ToolRegistry`, `ToolResult`, `ToolError`, `ToolContext`. |
| `tools/registry` | Stores registered tools and provides discovery, selection, and structured execution. | In-memory `Map` of registered tools. |
| `tools/read-state` | Tracks session-level files successfully read by an agent run. | In-memory set of normalized absolute file paths. |
| `tools/read-tool` | Reads local files and records successful reads. | Built-in `file_read` tool. |
| `tools/write-tool` | Writes full file contents while enforcing read-before-write for existing files. | Built-in `file_write` tool. |
| `tools/edit-tool` | Applies single textual edits while enforcing read-before-edit. | Built-in `file_edit` tool. |
| `tools/bash-tool` | Executes local commands from the workspace through a controlled result interface. | Built-in `bash` tool. |
| `context/types` | Defines context provider contracts and composed context payload types. | `ContextProvider`, `AgentContext`, memory/skills/tools/MCP payload types. |
| `context/composer` | Builds a single-agent context bundle from registered providers and tool descriptions. | Default local/static providers and `createContextComposer`. |
| `core/index` | Exposes stable package-level exports for runtime consumers. | Public package export surface. |

### 2.2 Boundaries

- **Entry points**: TypeScript package exports from `packages/core/src/index.ts`.
- **Trust boundary**: Runtime chooses which registered tools and context provider outputs are exposed to an agent run; tool modules do not perform agent orchestration.
- **External → Internal**: Runtime or agent loop → core package exports → tool registry/context composer → tool handlers or context payloads.

### 2.3 Target vs Baseline

| | Baseline (current) | Target (after change) |
|---|---|---|
| Tool discovery | Registry lists all tools and retrieves by id. | Registry lists all tools and retrieves selected tools by id or by name. |
| Registry ergonomics | `register()` returns `void`; tests incorrectly chain from `register()`. | Contract and tests agree: either non-chainable tests or chainable registry API, with no accidental undefined access. |
| File tools | Read/write/edit/bash tools exist with structured results. | Existing behavior retained and covered by passing tests. |
| Context composition | Composer exists but has no dedicated tests. | Dedicated tests prove typed provider injection, graceful empty context, and tool-description-only behavior. |

## 3. Interaction Design

### 3.1 Interaction Anchors (`INT-###`)

| ID | Intent (when this coupling matters) | Caller → Callee | Coupling Type | Information / State Crossing | Failure Propagation Expectation |
|---|---|---|---|---|---|
| `INT-001` | Runtime discovers and selects available tools. | Runtime → `ToolRegistry` | sync call | Tool definitions, names, ids, parameter schemas. | Unknown selections return `undefined` for lookup or structured `TOOL_NOT_FOUND` for execution. |
| `INT-002` | Read tool grants session write permission for a file. | `file_read` → `ReadState` | sync call after async I/O | Resolved file path becomes read-state entry. | Failed read does not mark read state. |
| `INT-003` | Write/edit tools enforce read-before-write. | `file_write`/`file_edit` → `ReadState` | sync check before async I/O | Resolved target path checked against session state. | Unread existing target returns `FILE_NOT_READ` and does not mutate content. |
| `INT-004` | Bash tool reports controlled command results. | Runtime → `bash` handler → Node child process | async local process | Command string, workspace cwd, timeout, stdout/stderr. | Non-zero exits/timeouts become `EXECUTION_FAILED` result objects. |
| `INT-005` | Context composer injects context for a single-agent run. | Runtime → `ContextComposer` → providers/registry | async provider calls | Memory, skills, tool descriptions, MCP metadata. | Empty optional providers return null or empty sections without failing the whole composition. |

### 3.2 Ordering / Concurrency Constraints (Design Level)

- Read-before-write checks are session-stateful: `file_read` must complete successfully before a write/edit to the same existing resolved path is permitted.
- Context composition can call independent providers concurrently because providers do not mutate tool execution state.
- Tool-selection contract changes must be implemented before tests that depend on the new selection behavior.

### 3.3 Requirement Links (Coarse-Grained Ordering)

- **Req 1 cluster**: `INT-001`.
- **Req 2 cluster**: `INT-002`.
- **Req 3 cluster**: `INT-002` → `INT-003`.
- **Req 4 cluster**: `INT-004`.
- **Req 5 cluster**: `INT-005`.

## 4. External Dependencies

### 4.1 Dependency Overview

| Dependency | Purpose | Official Documentation |
|---|---|---|
| Node.js file system APIs | Local workspace reads, writes, directory creation, and existence checks. | https://nodejs.org/api/fs.html |
| Node.js child process APIs | Bash command execution and process lifecycle control. | https://nodejs.org/api/child_process.html |
| Vitest | Test runner for package tests. | https://vitest.dev/guide/ |
| TypeScript ESM | Type and module compatibility for package exports. | https://www.typescriptlang.org/docs/handbook/modules/reference.html |

### 4.2 Node.js Built-in APIs

#### Factual Basis

| Required Capability | Documentation Location |
|---|---|
| Promise-based file reads/writes and recursive directory creation. | Node.js `fs/promises` API documentation. |
| Command execution with cwd, timeout, output, exit code, signal, and process termination. | Node.js `child_process` API documentation. |

**Version assumption**: Floating within the repo's supported Node runtime; no new dependency is introduced.

#### Limits and Failure Modes

| Category | Documented Fact | Coding Obligation |
|---|---|---|
| Size / Buffer | Child-process output can exceed configured buffer limits. | Keep maxBuffer explicit and return structured execution failure details. |
| Timeout / Termination | Child processes can timeout or be killed. | Preserve code, signal, stdout, and stderr in structured error details. |
| File I/O Errors | File operations can fail because paths are missing or inaccessible. | Map failures to structured tool errors and avoid read-state mutation on failed reads. |

#### Security and Keys

| Concern | Constraint |
|---|---|
| Authentication / Scope | No external credentials. Local runtime chooses whether to expose the bash tool. |
| Key Name | None. |

#### Integration Anchors (`EXT-###`)

| ID | Integration Surface (as named in docs) | Non-Negotiable Handling | Prohibited Assumptions |
|---|---|---|---|
| `EXT-001` | `node:fs/promises` | Failed reads/writes must become structured results. | Do not assume every path exists or is readable. |
| `EXT-002` | `node:child_process` | Failed commands must preserve output and exit metadata. | Do not assume zero exit or bounded output. |

## 5. Data Persistence

| Resource | Typical Readers / Writers (module key) | Consistency Expectation |
|---|---|---|
| Tool registry in-memory map | Written by runtime setup, read by runtime/context composer. | Duplicate ids rejected; list order follows registration order. |
| Read-state in-memory set | Written by `file_read`, read by `file_write` and `file_edit`. | Per-session state; normalized absolute paths must match across read/write/edit. |
| Workspace filesystem | Read by `file_read`/`file_edit`, written by `file_write`/`file_edit`, used as cwd by `bash`. | Existing file writes/edits require prior successful read in the same session. |
| Context payload object | Written by `context/composer`, read by runtime/agent loop. | Tool descriptions are metadata-only and must not execute tool handlers. |

## 6. System Invariants

| Invariant | How Architecture Could Violate It | Symptoms of Violation |
|---|---|---|
| Existing files cannot be written or edited before a successful session read. | Write/edit bypasses `ReadState` or normalizes paths differently than read. | Unread existing file mutates without `FILE_NOT_READ`. |
| Tool execution errors are structured. | Registry lets handler exceptions escape. | Agent loop receives thrown exceptions instead of `ToolResult`. |
| Tool context describes tools without executing them. | Context composer calls handlers or mutates `ReadState` while describing tools. | Context composition causes side effects or command execution. |
| Runtime remains orchestration owner. | Tool/context modules start agent-loop logic or choose model behavior. | Core foundation becomes coupled to agent loop concerns. |

## 7. Technical Trade-offs

| Decision | Rejected Alternatives | Lock-in Effect on Implementation |
|---|---|---|
| Keep registry in-process and dependency-free. | External plugin manager or persistent registry. | Runtime registers tools during setup; persistence can be added later outside this module. |
| Add name-based selection alongside id lookup. | Rename `get()` to accept names only, or require callers to scan `list()`. | Backward-compatible id lookup remains; name lookup semantics must be documented and tested. |
| Keep read state per session and in-memory. | Global read-state cache or filesystem markers. | Multi-agent/cross-session coordination remains out of scope. |
| Use current Node child process implementation. | Add shell abstraction dependency. | Bash behavior remains local and simple; runtime policy controls whether the tool is exposed. |
| Add focused tests rather than new abstractions. | Rebuild modules around a new framework. | Lower implementation risk because most functionality already exists. |

## 8. Design-Time Refactoring

| Finding | Affected Module | Tier (T1/T2/T3) | Disposition (Refactored / Scheduled / Deferred) | Test Evidence |
|---|---|---|---|---|
| Registry tests chain from `register()` even though the public interface returns `void`. | `packages/core/src/tools/registry.test.ts`, optionally `packages/core/src/tools/types.ts`, `packages/core/src/tools/registry.ts` | T2 | Scheduled: align contract and tests during implementation. | `pnpm test -- --run` currently fails 17 tests with undefined `.execute`. |
| Context composer has no dedicated test file. | `packages/core/src/context/composer.ts`, `packages/core/src/context/types.ts` | T2 | Scheduled: add context unit tests. | New tests in `packages/core/src/context/composer.test.ts`. |

## 9. References

- **Designed code file paths**:
  - `packages/core/src/tools/types.ts`
  - `packages/core/src/tools/registry.ts`
  - `packages/core/src/tools/read-state.ts`
  - `packages/core/src/tools/read-tool.ts`
  - `packages/core/src/tools/write-tool.ts`
  - `packages/core/src/tools/edit-tool.ts`
  - `packages/core/src/tools/bash-tool.ts`
  - `packages/core/src/tools/index.ts`
  - `packages/core/src/tools/registry.test.ts`
  - `packages/core/src/context/types.ts`
  - `packages/core/src/context/composer.ts`
  - `packages/core/src/context/index.ts`
  - `packages/core/src/context/composer.test.ts`
  - `packages/core/src/index.ts`
- **Project context files**:
  - `package.json`
  - `packages/core/package.json`
  - `vitest.config.ts`
  - `pnpm-workspace.yaml`
- **Related documents**:
  - `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`
  - `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md`
  - `docs/plans/2026-06-21/agent-runtime-foundation/references/node-runtime-apis.md`
- **Architecture exploration notes**:
  - `apltk codegraph --help` and `apltk codegraph files --help` were available, but CodeGraph indexing could not run because this checkout is not a Git repository and CodeGraph is not initialized.
  - `apltk architecture --help` was available. No base atlas exists under `resources/project-architecture/`, so no architecture overlay was generated for this small core-package change.
