# Jovaltus — CLAUDE.md

## Common Development Commands

| Command | Description |
|---|---|
| `pnpm test -- --run` | Run all tests (vitest) |
| `pnpm typecheck` | TypeScript type checking across workspace |
| `pnpm lint` | ESLint across workspace |
| `pnpm build` | Build all packages |
| `pnpm clean` | Remove dist directories and build info |
| `apltk codegraph status` | Code graph index statistics |
| `apltk codegraph query <symbol>` | Search indexed symbols |
| `apltk codegraph context <question>` | Build task-oriented context |
| `apltk codegraph callers/callees <symbol>` | Find callers or callees |
| `apltk codegraph impact <symbol>` | Analyze change impact radius |

## Business Goals

Jovaltus (歲淵) is a VS Code AI coding agent MVP. It provides a safe runtime for agent tool execution (file read/write/edit, bash) and composable agent context, targeting an IDE-integrated coding agent experience.

## Documentation Index

- `docs/architecture/core-package.md` — Module boundaries and data flow
- `docs/features/agent-runtime.md` — BDD feature specifications
- `docs/principles/error-handling.md` — Structured tool error conventions
- `docs/principles/testing-conventions.md` — Test placement and patterns
- `README.md` — Project overview
- `packages/core/CLAUDE.md` — Core package constraints
- `apps/extension/CLAUDE.md` — Extension package constraints

## Architecture Constraints

1. **Tool modules** own tool registration, execution, and read tracking. They never call context modules or agent loop logic.
2. **Context modules** compose context from providers but never execute tool handlers.
3. **ReadState** is per-session, in-memory. No cross-session sharing.
4. **Tool errors** are always structured (`ToolResult`). Handlers never throw past the registry.
5. **No new dependencies** without explicit approval. Prefer Node built-in APIs.

## Prohibitions

- Never bypass `resolveInWorkspace()` for boundary checks — unresolved paths can be exploited via symlinks (fixed in `ba6f8f6`)
- Always validate numeric parameters (e.g. `timeoutMs`) at handler entry with explicit range checks before any I/O (fixed in `e43fb17`)
- Never execute tool handlers or mutate read state during context composition — context is metadata only (`src/context/composer.ts`)

## Testing

- Tests co-located with source (`.test.ts` suffix)
- File tool tests use real temp directories, not mocks
- Registry tests use explicit local variable pattern (not chaining)
