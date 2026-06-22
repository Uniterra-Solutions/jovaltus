# apps/extension

VS Code extension entry point — activates and bootstraps Jovaltus agent tooling into the IDE.

## Module File List

- `src/extension.ts` — Extension activate/deactivate hooks
- `package.json` — Extension manifest (VS Code engine, activation events)
- `tsconfig.json` — TypeScript config (references core package)

## Rules Should Not Be Violated

- Must not duplicate or reimplement core runtime logic — import from `@jovaltus/core`
- Extension activation must be non-blocking and side-effect-free until a user action triggers agent operations
- Must not hardcode VS Code engine API surface beyond what `@types/vscode` declares
