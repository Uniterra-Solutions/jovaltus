# Testing Conventions

## Tests Colocate with Source

Unit tests live next to the source files they exercise, using the `*.test.ts` naming convention. Vitest discovers tests under `packages/**/*.test.ts` and `apps/**/*.test.ts`.

**理由**: Colocation makes tests easy to find and update when the corresponding module changes.

**範例**: `packages/core/src/index.test.ts` covers `packages/core/src/index.ts`.

## Tests Use Explicit Imports

Tests import the functions under test with explicit named imports rather than relying on Vitest globals.

**理由**: Explicit imports keep tests self-documenting and avoid coupling to a specific test runner's global injection.

**範例**: `packages/core/src/index.test.ts:1-3` imports `describe`, `expect`, `it` from `vitest` and `createAgentTask` from `./index.js`.

## Coverage is Reported as Text and LCOV

Vitest emits coverage in both human-readable text and machine-readable LCOV formats. This supports local development feedback and downstream coverage visualization.

**理由**: Dual reporters satisfy immediate CLI feedback and integration with coverage dashboards without extra configuration.

**範例**: `vitest.config.ts:5-7` configures `reporter: ['text', 'lcov']`.
