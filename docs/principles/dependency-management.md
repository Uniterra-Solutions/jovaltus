# Dependency Management

## Internal Dependencies Use `workspace:*`

Cross-package dependencies inside the monorepo are declared with the `workspace:*` protocol. This pins the package to the local copy and prevents accidental drift against an external registry version.

**理由**: Workspace aliases guarantee that changes in `packages/core` are immediately reflected in `apps/extension` without version bumps or lockfile churn.

**範例**: `apps/extension/package.json:23` declares `"@jovaltus/core": "workspace:*"`.

## Build Tools Are Declared at the Root

TypeScript, ESLint, Prettier, Vitest, and the VS Code packaging tool are installed as root devDependencies. Sub-packages declare only their runtime or type-specific dependencies, such as `@types/vscode` for the extension host.

**理由**: Centralizing build tools avoids version skew across packages and ensures a single lockfile governs the entire workspace.

**範例**: Root devDependencies include `typescript`, `eslint`, `vitest`, and `@vscode/vsce` at `package.json:18-30`.

## Native Build Permissions Are Explicit

The pnpm workspace configuration allows native builds only for packages that are known to require compiled native dependencies.

**理由**: Granting native build permission narrowly reduces the attack surface of dependency installation in CI and on developer machines.

**範例**: `pnpm-workspace.yaml:4-6` sets `allowBuilds` for `@vscode/vsce-sign` and `keytar`.
