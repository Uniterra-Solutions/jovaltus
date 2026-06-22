# Monorepo Layout

## Workspace Boundaries

The repository is a pnpm workspace with two boundary types: host applications under `apps/` and shared libraries under `packages/`. The root `tsconfig.json` lists project references that match the workspace globs, so TypeScript compilation order follows the same boundaries as the package manager.

## Dependency Direction

Host applications may depend on shared packages; shared packages must not depend on host applications. The only current cross-boundary dependency is from the extension host to the core package, declared with the `workspace:*` protocol.

## Validation is Centralized at the Root

Root `package.json` scripts are the single source of truth for lint, typecheck, test, build, and package commands. CI and README both reference these root scripts rather than invoking sub-package scripts directly. This keeps local development and CI behavior aligned.

## Source Evidence

- Workspace globs: `pnpm-workspace.yaml:1-3`
- Root project references: `tsconfig.json:1-4`
- Root validation scripts: `package.json:8-17`
- Extension host depends on core: `apps/extension/package.json:22-24`
