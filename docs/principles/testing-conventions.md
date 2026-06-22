# Testing Conventions

## Test File Placement

Tests are co-located with their source files using the `.test.ts` suffix. Each test file tests one source module. Vitest discovers tests under `packages/**/*.test.ts` and `apps/**/*.test.ts`.

**Evidence**: `packages/core/src/tools/registry.test.ts` tests `registry.ts`; `packages/core/src/context/composer.test.ts` tests `composer.ts`

**Reason**: Co-location makes it easy to find tests for a given module and keeps imports relative.

## Tests Use Explicit Imports

Tests import `describe`, `expect`, `it` from `vitest` rather than relying on Vitest globals. Functions under test use explicit named imports.

**Evidence**: `packages/core/src/index.test.ts:1-3` imports `describe`, `expect`, `it` from `vitest` and `createAgentTask` from `./index.js`.

**Reason**: Explicit imports keep tests self-documenting and avoid coupling to a specific test runner's global injection.

## Integration-Style Unit Tests

File system tool tests use real temp directories (`mkdtempSync`) instead of mocking `fs/promises`. Bash tool tests use real `child_process` execution with simple deterministic commands.

**Evidence**: `packages/core/src/tools/registry.test.ts` — `setup()` helper creates a temp directory and `createReadState(root)` for each test.

**Reason**: Testing against real filesystem and process boundaries catches integration issues that mocks would miss, while temp directories ensure isolation and cleanup.

## Structured Setup Helper

Tests that need a filesystem use a `setup()` function that returns `{ root, context }` where `context` includes `workspaceRoot` and `readState`. Tests that only need the registry do not call `setup()`.

**Evidence**: `packages/core/src/tools/registry.test.ts:21-25`

**Reason**: Keeping setup minimal per test avoids unnecessary filesystem I/O and makes test intent clear.

## Registry-as-Local-Variable Pattern

Tests use an explicit local `registry` variable rather than chaining calls from `createToolRegistry()`.

```typescript
const registry = createToolRegistry();
registry.register(createReadTool());
const result = await registry.execute('file_read', { filePath: 'sub/hello.txt' }, context);
```

**Evidence**: All tool tests in `packages/core/src/tools/registry.test.ts`

**Reason**: `register()` returns `void` so chaining is not possible (`registry is undefined`). The explicit pattern is also clearer about what is being registered and executed.

## Coverage Reporting

Vitest emits coverage in both human-readable text and machine-readable LCOV formats. This supports local development feedback and downstream coverage visualization.

**Evidence**: `vitest.config.ts:5-7` configures `reporter: ['text', 'lcov']`.
