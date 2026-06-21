# VS Code Extension Platform

## Extension Host is a Thin Bootstrap Surface

The extension host package owns the VS Code activation contract. Its responsibility is limited to bootstrapping the extension context and delegating to shared primitives; it does not contain user-facing commands, webviews, or status bar features.

## Shared Primitives Live in `packages/core`

Agent-facing primitives such as task objects are defined in the core package. The extension host imports these primitives through the workspace package alias, keeping host-specific code separate from reusable domain concepts.

## Build Output is Materialized Before Packaging

The extension host declares a `main` entry that points to a compiled artifact under `dist/`. The root `build` script must run before `package` so that the VSIX packager operates on emitted JavaScript rather than source TypeScript.

## Packaging is Decoupled from Publishing

The packaging script produces a local `.vsix` artifact. CI uploads that artifact, but no workflow step publishes to the VS Code Marketplace or creates release tags. This keeps the platform focused on repeatable distribution artifacts rather than release policy.

## Source Evidence

- Extension host manifest and entrypoint: `apps/extension/package.json:9-16`
- Extension activation and core delegation: `apps/extension/src/extension.ts:1-17`
- Core task primitive: `packages/core/src/index.ts:1-22`
- Root build-before-package script: `package.json:14`
- CI artifact upload without publishing: `.github/workflows/ci.yml:41-49`
