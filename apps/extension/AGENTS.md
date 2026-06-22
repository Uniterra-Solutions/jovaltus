# MODULE DESCRIPTION

The VS Code extension host package. It owns the activation contract with VS Code and bootstraps the extension context by delegating to shared primitives in `packages/core`. It does not implement user-facing commands, webviews, status bar features, or agent loop behavior.

# MODULE FILE LIST

- `package.json` — Extension manifest, engine compatibility, scripts, and workspace dependency on `@jovaltus/core`.
- `tsconfig.json` — TypeScript project reference configuration extending the base config.
- `src/extension.ts` — Extension `activate` and `deactivate` entrypoints.
- `.vscodeignore` — Files excluded from the packaged VSIX.

# RULES SHOULD NOT BE VIOLATED

- The extension host must remain a thin bootstrap surface; domain logic belongs in `packages/core` or future feature packages.
- The extension must declare `engines.vscode` compatibility and a `main` entry that points to emitted JavaScript under `dist/`.
- The package must use `workspace:*` to depend on `@jovaltus/core`.
- Generated `.vsix` and `dist/` outputs must not be committed to source control.
- The `package` script must write the VSIX to `dist/jovaltus-extension.vsix` so CI and README instructions stay aligned.
