# Jovaltus — AGENTS.md

For non-Claude agents (Codex, Copilot, etc.).

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

Jovaltus (歲淵) is a VS Code AI coding agent MVP: a safe runtime for agent tool execution (file read/write/edit, bash) and composable agent context.

## Documentation Index

- `docs/architecture/core-package.md` — Module boundaries and data flow
- `docs/features/agent-runtime.md` — BDD feature specifications
- `docs/principles/error-handling.md` — Structured tool error conventions
- `docs/principles/testing-conventions.md` — Test placement and patterns
- `README.md` — Project overview
- `packages/core/AGENTS.md` — Core package constraints
- `apps/extension/AGENTS.md` — Extension package constraints

## Prohibitions

- Never bypass `resolveInWorkspace()` for boundary checks — unresolved paths can be exploited via symlinks (fixed in `ba6f8f6`)
- Always validate numeric parameters (e.g. `timeoutMs`) at handler entry with range checks before I/O (fixed in `e43fb17`)
- Never execute tool handlers or mutate read state during context composition — context is metadata only (`src/context/composer.ts`)
