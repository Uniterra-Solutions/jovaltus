import { build } from 'esbuild';

// Bundle the VS Code extension host entry into a single self-contained CJS file.
// @jovaltus/core and its dependency tree are inlined so the VSIX needs no node_modules.
// Only `vscode` stays external — it is provided by the extension host at runtime.
await build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['vscode'],
  // @jovaltus/core (CJS) requires ESM-only deps such as @earendil-works/pi-ai
  // (type: module, exports only an `import` condition). esbuild defaults to the
  // `require` condition for require() calls, which would not resolve them.
  // Enable `import` so esbuild reads their ESM and inlines it into the CJS bundle.
  conditions: ['import', 'require', 'node', 'default'],
  mainFields: ['module', 'main'],
  outfile: 'dist/extension.js',
  sourcemap: true,
  logLevel: 'info',
});
