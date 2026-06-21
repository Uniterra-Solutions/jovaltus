# Jovaltus — CLAUDE.md

## Project Structure

```
jovaltus-main/
├── apps/extension/          # IDE extension entry
├── docs/
│   ├── architecture/        # Module design principles
│   ├── features/            # User-visible behavior (BDD)
│   ├── plans/               # Implementation plans
│   └── principles/          # Code conventions
├── packages/core/           # Core runtime (TypeScript ESM)
│   └── src/
│       ├── context/         # Agent context composition
│       ├── tools/           # Tool registry + built-in tools
│       └── index.ts         # Public API surface
├── package.json             # Root workspace config
├── pnpm-workspace.yaml
└── vitest.config.ts
```

## Key Commands

| Command | Description |
|---|---|
| `pnpm test -- --run` | Run all tests |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | ESLint |
| `pnpm build` | Build all packages |

## Architecture Constraints

1. **Tool modules** own tool registration, execution, and read tracking. They do not call context modules or agent loop logic.
2. **Context modules** compose context from providers but never execute tool handlers.
3. **ReadState** is per-session, in-memory. No cross-session sharing.
4. **Tool errors** are always structured (`ToolResult`). Handlers never throw past the registry.
5. **No new dependencies** without explicit approval. Prefer Node built-in APIs.

## Testing

- Tests co-located with source (`.test.ts` suffix)
- File tool tests use real temp directories, not mocks
- Registry tests use explicit local variable pattern (not chaining)
