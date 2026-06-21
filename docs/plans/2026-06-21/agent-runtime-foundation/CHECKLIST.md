# Checklist: Agent Runtime Foundation

- **Date**: 2026-06-21
- **Feature**: Agent Runtime Foundation
- **Source SPEC**: `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`

> **Purpose:** Verification strategy — defines how to confirm that the implementation satisfies the SPEC.md business requirements. Produced using the `test-case-strategy` skill.

---

## Behavior-to-Test Checklist

| ID | Observable Behavior | SPEC Requirement | Corresponding Test | Result |
|---|---|---|---|---|
| CL-01 | Registry lists all tools and retrieves selected tools by id or name. | Req 1 | UT-01 in `packages/core/src/tools/registry.test.ts` | Pending |
| CL-02 | Registry duplicate ids, unknown execution, and thrown handlers produce deterministic outcomes. | Req 1 | UT-02 in `packages/core/src/tools/registry.test.ts` | Pending |
| CL-03 | Read tool returns file contents and marks the resolved file as read only after a successful read. | Req 2 | IT-01 in `packages/core/src/tools/registry.test.ts` | Pending |
| CL-04 | Write tool creates new files and parent directories, but rejects existing unread files. | Req 3 | IT-02 in `packages/core/src/tools/registry.test.ts` | Pending |
| CL-05 | Edit tool requires prior read state and reports missing `oldString` without modifying content. | Req 3 | IT-03 in `packages/core/src/tools/registry.test.ts` | Pending |
| CL-06 | Bash tool runs commands from workspace cwd and returns structured failures for invalid or failing commands. | Req 4 | IT-04 in `packages/core/src/tools/registry.test.ts` | Pending |
| CL-07 | Context composer returns memory, skills, tool descriptions, and MCP context, with graceful empty defaults. | Req 5 | UT-03 in `packages/core/src/context/composer.test.ts` | Pending |
| CL-08 | Tool context generation describes tools without executing handlers or mutating read state. | Req 5 | UT-04 in `packages/core/src/context/composer.test.ts` | Pending |

## Hardening Checklist

- [ ] Regression tests for bug-prone / high-risk behavior: read-before-write and registry error wrapping must be covered.
- [ ] Unit drift checks for non-trivial logic: registry lookup/listing, context composition defaults, and provider injection must be covered.
- [ ] Property-based coverage for business logic: N/A because current logic is small deterministic API behavior with clearer example-based oracles.
- [ ] External services mocked / faked: N/A because no external service is introduced; filesystem and child process behavior use temp directories and local commands.
- [ ] Adversarial cases for abuse paths: unread existing file write/edit attempts, unknown tools, thrown handlers, invalid params, command failure.
- [ ] Authorization, idempotency, and concurrency risks assessed: runtime selection is in scope; permission UI and multi-agent read-state sharing are out of scope.
- [ ] Assertions verify outcomes and side-effects, not just success flags: read state and file content must be asserted where behavior mutates state.
- [ ] Fixtures are reproducible: tests must use temp directories and simple deterministic shell commands.

## E2E / Integration Decisions

| Flow / Risk | Test Level | Rationale |
|---|---|---|
| Registry contract and selection by id/name | Unit | In-memory API with no external dependencies. |
| Read/write/edit file tools with read-state guard | Integration-style unit test with temp filesystem | Requires collaboration among registry, tool handler, read state, and filesystem. |
| Bash command execution | Integration-style unit test with local process | Behavior crosses into Node child process execution; use deterministic commands. |
| Context provider composition | Unit | Provider calls can be faked in-process and verified without runtime orchestration. |
| Full agent loop using tools and context | N/A | Agent loop orchestration is explicitly out of scope. |

## References

- **Designed code file paths**:
  - `packages/core/src/tools/types.ts`
  - `packages/core/src/tools/registry.ts`
  - `packages/core/src/tools/registry.test.ts`
  - `packages/core/src/context/types.ts`
  - `packages/core/src/context/composer.ts`
  - `packages/core/src/context/composer.test.ts`
- **Project context files**:
  - `package.json`
  - `vitest.config.ts`
- **Related documents**:
  - `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md`
  - `docs/plans/2026-06-21/agent-runtime-foundation/DESIGN.md`
