# MODULE DESCRIPTION

The shared core package for agent-facing primitives. It defines reusable data structures and helper functions used by the VS Code extension host and future modules.

# MODULE FILE LIST

- `package.json` — Package manifest, exports map, and build scripts.
- `tsconfig.json` — TypeScript project reference configuration extending the base config.
- `src/index.ts` — `AgentTask` interface and `createAgentTask` factory.
- `src/index.test.ts` — Unit tests for `createAgentTask`.

# RULES SHOULD NOT BE VIOLATED

- The core package must not depend on host applications (`apps/*`) or VS Code APIs.
- Public exports must be listed in `exports` so consumers can resolve both types and runtime code.
- All public functions must have accompanying unit tests in colocated `*.test.ts` files.
- Domain invariants (such as non-empty task id and prompt) must be enforced at the factory boundary with explicit errors.
