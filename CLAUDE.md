# Common Development Commands

- `pnpm install` — Install workspace dependencies using the frozen lockfile locally.
- `pnpm lint` — Run ESLint across the workspace.
- `pnpm typecheck` — Run TypeScript project reference build with `--noEmit` semantics.
- `pnpm test` — Run Vitest test suites in `packages/**/*.test.ts` and `apps/**/*.test.ts`.
- `pnpm build` — Build all TypeScript project references in dependency order.
- `pnpm package` — Build the workspace and package the extension into `dist/jovaltus-extension.vsix`.
- `pnpm format` — Format files with Prettier.
- `apltk codegraph <subcommand>` — CodeGraph codebase exploration (run `--help` first).
- `apltk architecture [verb]` — Inspect or mutate the project architecture atlas (run `--help` first).

# Project Business Goals

- Provide a stable VS Code extension host for the Jovaltus AI coding agent MVP so that future features can be integrated, tested, and distributed from a reliable foundation.
- Keep local development and CI validation identical through root-level scripts, frozen lockfiles, and a single artifact packaging path.

# Project Documentation Index

- `docs/features/vscode-extension-platform.md` — User-visible behaviors for the VS Code extension platform.
- `docs/architecture/monorepo-layout.md` — Workspace boundaries and dependency direction rules.
- `docs/architecture/vscode-extension-platform.md` — Extension host, core primitives, and packaging architecture.
- `docs/principles/dependency-management.md` — Internal and external dependency conventions.
- `docs/principles/testing-conventions.md` — Test placement, imports, and coverage conventions.
- `docs/principles/typescript-conventions.md` — Strictness, type imports, and project reference conventions.
- `docs/principles/ci-conventions.md` — CI ordering, frozen lockfile, and artifact upload conventions.
- `README.md` — Quick-start development and packaging instructions.
- `apps/extension/CLAUDE.md` — Constraints for the VS Code extension host package.
- `packages/core/CLAUDE.md` — Constraints for the shared core package.

## Prohibitions

- Do not add user-facing commands, webviews, status bar features, or agent loop behavior to the extension host without a dedicated spec and design review.
- Do not publish the `.vsix` to the VS Code Marketplace or create release tags from CI without an explicit release spec.
- Do not commit generated artifacts such as `.vsix` files or `dist/` contents to source control.
- Do not declare dependencies between shared packages (`packages/*`) and host applications (`apps/*`). Dependencies must flow from apps to packages only.
