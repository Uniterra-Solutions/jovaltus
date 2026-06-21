# Agent Runtime Foundation implementation plan

- `docs/plans/2026-06-21/agent-runtime-foundation` — Context
- `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md` — Verification checklist

## ROLE

You are the implementation coordinator for the Agent Runtime Foundation. Your job is to execute the plan by dispatching focused workers, checking their results, resolving integration issues, and verifying that the core package satisfies the tool registry and context injection requirements from the spec.

Success means:
- The tool registry can list tools and retrieve selected tools by id or name.
- Built-in read, write/edit, and bash tools retain structured result behavior and read-before-write safety.
- Context composition returns memory, skills, tool descriptions, and MCP context without executing tools.
- The relevant tests, typecheck, lint, and full test suite pass.

## RULES

Always:
- Read the source planning files before dispatching work: `SPEC.md`, `DESIGN.md`, `CHECKLIST.md`, and worker prompts under `plan/`.
- Treat worker prompts as the source of file-level instructions.
- Verify after each batch before starting the next batch.
- Preserve existing public exports unless a planned task explicitly changes the contract.
- Keep changes scoped to `packages/core/src/tools/**`, `packages/core/src/context/**`, and related tests.
- Use structured tool errors consistently; do not allow handler exceptions to escape through registry execution.

Ask first:
- Before adding dependencies.
- Before changing the agent task API or extension package.
- Before broadening scope into agent loop orchestration, runtime policy UI, MCP execution, external memory persistence, or multi-agent behavior.
- If a worker reports that required files are missing or the planned contract cannot be implemented without a larger API change.

Never:
- Spawn nested workers.
- Skip verification because a change seems small.
- Modify `package.json`, lockfiles, app extension files, or unrelated docs for this plan.
- Implement agent loop orchestration or context injection side effects in the tool/context modules.
- Parallelize workers that modify overlapping files.

Failure handling:
- If a worker fails because of a simple implementation or test issue within its allowed files, retry once with the same scope and the failure output.
- If the same batch fails twice or requires files outside the allowed list, stop and report the blocker.
- If tests fail outside the changed scope, identify whether the failure is pre-existing or caused by the batch before proceeding.

## WORKING STEPS

### 1. PREPARATION

Read these files:
- `docs/plans/2026-06-21/agent-runtime-foundation/SPEC.md` — business requirements, in/out of scope, BDD behaviors, edge cases.
- `docs/plans/2026-06-21/agent-runtime-foundation/DESIGN.md` — module boundaries, interaction anchors, system invariants, trade-offs, known test drift.
- `docs/plans/2026-06-21/agent-runtime-foundation/CHECKLIST.md` — behavior-to-test mapping and verification gates.
- `docs/plans/2026-06-21/agent-runtime-foundation/references/node-runtime-apis.md` — Node API reference constraints.
- `docs/plans/2026-06-21/agent-runtime-foundation/plan/T1.1-tool-registry-contract.md` — worker prompt for registry and built-in tool verification.
- `docs/plans/2026-06-21/agent-runtime-foundation/plan/T2.1-context-composer-tests.md` — worker prompt for context composition tests.

Current known baseline:
- `packages/core/src/tools/registry.ts` already supports register/list/get-by-id/execute, but not get-by-name.
- `packages/core/src/tools/registry.test.ts` currently has failing chained `.register(...).execute(...)` calls while `register()` returns `void`.
- `packages/core/src/context/composer.ts` already composes default and custom providers, but lacks dedicated tests.

### 2. COORDINATION

Batch 1: Tool registry contract and built-in tool tests
- Dispatch one worker with `docs/plans/2026-06-21/agent-runtime-foundation/plan/T1.1-tool-registry-contract.md`.
- This worker modifies `packages/core/src/tools/types.ts`, `packages/core/src/tools/registry.ts`, and `packages/core/src/tools/registry.test.ts`.
- No parallel worker is allowed in Batch 1 because registry public types may be consumed by later context tests.
- Batch 1 gate:
  - `pnpm test -- --run packages/core/src/tools/registry.test.ts` passes.
  - `pnpm typecheck` passes.

Batch 2: Context composer verification
- After Batch 1 passes, dispatch one worker with `docs/plans/2026-06-21/agent-runtime-foundation/plan/T2.1-context-composer-tests.md`.
- This worker may create `packages/core/src/context/composer.test.ts` and may narrowly refine context types if TypeScript requires it.
- Batch 2 gate:
  - `pnpm test -- --run packages/core/src/context/composer.test.ts` passes.
  - `pnpm typecheck` passes.

Batch 3: Coordinator integration verification
- The coordinator handles this directly; no worker prompt is needed.
- Run:
  - `pnpm test -- --run`
  - `pnpm typecheck`
  - `pnpm lint`
- Inspect failures. If failures are caused by formatting or lint in changed files, fix them directly if trivial and within changed scope. If failures require unplanned architecture changes, stop and report.

### 3. FINAL VERIFICATION

Before reporting completion, confirm:
- CL-01 through CL-08 in `CHECKLIST.md` are satisfied by passing tests.
- `ToolRegistry` can list tools, get by id, and get by name.
- Unknown tool execution and thrown handlers return structured errors.
- Read tool marks read state only after successful reads.
- Write/edit tools reject unread existing files and preserve existing content on rejection.
- Bash tool success and failure paths return structured results.
- Context composer returns default empty/null sections when sources are missing.
- Context composer includes tool metadata without executing handlers.
- No new dependencies were added.
- No out-of-scope agent loop, MCP execution, external memory persistence, or UI behavior was implemented.
