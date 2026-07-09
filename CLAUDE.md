# Common Development Commands

- `pnpm run build` — TypeScript compilation (tsc -b)
- `pnpm run typecheck` — Type-check without emitting output
- `pnpm run lint` — ESLint validation (max-warnings 0 enforced)
- `pnpm run format` — Prettier formatting (single quotes, trailing commas, 100 width, LF)
- `pnpm run test` — Vitest test suite (co-located `__tests__/` dirs)
- `pnpm run package` — Build VSIX distribution for the extension
- `pnpm install --frozen-lockfile` — Install dependencies in CI (never `pnpm install` without `--frozen-lockfile`)

# Project Business Goals

- Provide an AI coding agent for VS Code with a **multi-layer quality pipeline** (review → fix → simplify cycles)
- Use **context isolation** and **clean-diff handoffs** between agents to minimise token waste — each agent sees only what it needs
- Separate **coordinator** (decision-making, high-capability model) from **worker** (implementation, cost-efficient model) roles
- Implement **behaviour-by-configuration**: agent roles are defined by system prompt + tool preset, not hard-coded logic

# Project Documentation Index

- `docs/features/chat-interface.md` — Chat panel: send, receive, theme adaptation
- `docs/features/agent-operations.md` — File read/write/edit and bash execution (core engine; not yet wired to UI)
- `docs/features/configuration.md` — VS Code settings for models and providers
- `docs/architecture/core-package.md` — Core engine: agent factory, model abstraction, config layering
- `docs/architecture/extension-package.md` — Extension: activation, message protocol, webview architecture
- `docs/architecture/tool-system.md` — Tool definitions, presets, ToolRegistry, directory guard
- `docs/principles/naming-conventions.md` — File/module/class/function naming
- `docs/principles/coding-style.md` — TS strictness, import order, export conventions
- `docs/principles/testing-conventions.md` — Vitest patterns, temp-dir isolation, mock strategy
- `docs/principles/error-handling.md` — ModelError codes, HTTP mapping, provider error classification
- `docs/jovaltus-proposal.md` — Original product proposal and design vision
- `README.md` — Project overview
- `packages/core/CLAUDE.md` — Core engine module constraints
- `packages/extension/CLAUDE.md` — Extension module constraints

## Prohibitions

- Never remove `.js` extensions from internal imports — they are required by NodeNext ESM module resolution. Evidence: `tsconfig.base.json:13` (`module: "NodeNext"`)
- Never use the `any` type — blocked by `no-explicit-any: error` in `eslint.config.mjs:30`
- Never run `pnpm install` without `--frozen-lockfile` in CI — CI enforces this at `.github/workflows/ci.yml:25`
- Never commit TypeScript files that fail ESLint with warnings — pre-commit runs `lint-staged --no-stash` with `--max-warnings 0` at `.husky/pre-commit:2`
- Never bump Node below 22 — pinned in `.nvmrc:1` and `package.json:5`
- Never add default exports — only named exports are used throughout the codebase per `eslint.config.mjs:29`
