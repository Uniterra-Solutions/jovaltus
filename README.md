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
pnpm package
```

### VS Code Extension Development Host

The extension host package is `apps/extension`.

1. Run `pnpm install` and `pnpm build` to prepare the workspace.
2. Open the repository in VS Code.
3. Start the Extension Development Host with `F5` or **Debug: Start Debugging**.

The scope is host launch readiness; no user-facing commands are expected yet.

### VSIX Packaging

- Run `pnpm package`.
- The expected output is `dist/jovaltus-extension.vsix`.
- CI uploads the generated `.vsix` as an artifact.

## Workspaces

- `apps/extension`: VS Code extension host package.
- `packages/core`: shared core package for agent-facing primitives.
