import { describe, it, expect, beforeAll } from 'vitest';
import { build, type BuildOptions } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

// vitest runs from the repo root (its config lives there), so the host entry is
// resolved relative to cwd rather than import.meta.url (which tsc rejects for
// CJS output — this test compiles into dist via tsc -b).
const HOST_ENTRY = resolve(process.cwd(), 'packages/extension/src/extension.ts');

// Mirrors packages/extension/build.mjs so the test exercises the production config.
const bundleConfig: BuildOptions = {
  entryPoints: [HOST_ENTRY],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['vscode'],
  conditions: ['import', 'require', 'node', 'default'],
  mainFields: ['module', 'main'],
  write: false,
  logLevel: 'silent',
};

describe('extension host bundle', () => {
  // Regression for the loading bug: the shipped host previously did
  // require('@jovaltus/core') but the VSIX carried no node_modules, so the
  // extension threw MODULE_NOT_FOUND at activation and the webview hung on the
  // loading screen. The host must bundle its whole dependency tree.
  let code: string;

  beforeAll(async () => {
    const result = await build(bundleConfig);
    const output = result.outputFiles?.[0];
    if (!output) throw new Error('esbuild produced no output');
    code = output.text;
  });

  it('inlines @jovaltus/core so the VSIX needs no node_modules', () => {
    expect(code).not.toMatch(/require\(["']@jovaltus\/core["']\)/);
    // vscode is provided by the extension host and must stay external.
    expect(code).toMatch(/require\(["']vscode["']\)/);
  });

  it('activates without MODULE_NOT_FOUND when only vscode is provided', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-bundle-'));
    const bundlePath = join(dir, 'extension.cjs');
    const stubPath = join(dir, 'vscode.cjs');
    const runner = join(dir, 'run.cjs');
    writeFileSync(bundlePath, code);
    writeFileSync(stubPath, 'module.exports = {};');
    // Real Node, no workspace node_modules on the resolution path — vscode is
    // the only module provided. If core were not bundled, this throws here.
    writeFileSync(
      runner,
      `const Module = require('module');
       const orig = Module._resolveFilename;
       Module._resolveFilename = function (req, ...rest) {
         if (req === 'vscode') return ${JSON.stringify(stubPath)};
         return orig.call(this, req, ...rest);
       };
       const ext = require(${JSON.stringify(bundlePath)});
       process.stdout.write(typeof ext.activate);`,
    );
    const out = execSync(`node ${JSON.stringify(runner)}`, { encoding: 'utf-8' }).trim();
    expect(out).toBe('function');
  });
});
