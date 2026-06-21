# Jovaltus

歲淵 - VS Code AI coding agent MVP.

## Development

This repository is a pnpm TypeScript monorepo.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Workspaces

- `apps/extension`: VS Code extension host package.
- `packages/core`: shared core package for agent-facing primitives.
