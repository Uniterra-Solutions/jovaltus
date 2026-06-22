# Jovaltus — CLAUDE.md

## Common Development Commands

| Command | Description |
|---|---|
| `pnpm install` | Install workspace dependencies using frozen lockfile |
| `pnpm test -- --run` | Run all tests (vitest) |
| `pnpm typecheck` | TypeScript type checking across workspace |
| `pnpm lint` | ESLint across workspace |
| `pnpm build` | Build all TypeScript project references |
| `pnpm clean` | Remove dist directories and build info |
| `pnpm format` | Format files with Prettier |
| `pnpm package` | Build workspace and package VSIX into `dist/` |
| `apltk codegraph <subcommand>` | CodeGraph codebase exploration (run `--help` first) |
| `apltk architecture [verb]` | Inspect or mutate the project architecture atlas |

## Business Goals

- Provide a stable VS Code extension host for the Jovaltus AI coding agent MVP with a safe runtime for agent tool execution (file read/write/edit, bash) and composable agent context.
- Keep local development and CI validation identical through root-level scripts, frozen lockfiles, and a single artifact packaging path.

## Documentation Index

- `docs/features/agent-runtime.md` — Agent runtime BDD feature specs
- `docs/features/vscode-extension-platform.md` — VS Code extension platform BDD
- `docs/architecture/core-package.md` — Core package module boundaries and data flow
- `docs/architecture/monorepo-layout.md` — Workspace boundaries and dependency rules
- `docs/architecture/vscode-extension-platform.md` — Extension host architecture
- `docs/principles/error-handling.md` — Structured tool error conventions
- `docs/principles/testing-conventions.md` — Test placement and patterns
- `docs/principles/dependency-management.md` — Internal/external dependency conventions
- `docs/principles/typescript-conventions.md` — Strictness, type imports, project references
- `docs/principles/ci-conventions.md` — CI ordering, frozen lockfile, artifact upload
- `README.md` — Quick-start development and packaging
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
- Always validate numeric parameters (e.g. `timeoutMs`) at handler entry with range checks before I/O (fixed in `e43fb17`)
- Never execute tool handlers or mutate read state during context composition — context is metadata only
- Do not add user-facing commands, webviews, or agent loop behavior to the extension host without a spec review
- Do not publish `.vsix` to VS Code Marketplace or create release tags without a release spec
- Do not commit generated artifacts (`.vsix`, `dist/`) to source control
- Dependencies must flow from `apps/*` to `packages/*` only — not the reverse

## Testing

- Tests co-located with source (`.test.ts` suffix)
- File tool tests use real temp directories, not mocks
- Registry tests use explicit local variable pattern (not chaining)
