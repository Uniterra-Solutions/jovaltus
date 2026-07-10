import { describe, it, expect, vi } from 'vitest';

// chat-panel.ts top-level imports vscode + @jovaltus/core; buildWebviewHtml uses neither.
// @jovaltus/core → @earendil-works/pi-ai is ESM-only, so mock it for the node test env.
vi.mock('vscode', () => ({}));
vi.mock('@jovaltus/core', () => ({ ConfigManager: vi.fn(), AgentModeOrchestrator: vi.fn() }));

import { buildWebviewHtml, injectInitMeta } from '../chat-panel.js';
import { parseInitMeta } from '../webview/init-models.js';

const SAMPLE_HTML =
  '<!DOCTYPE html><html><head>' +
  '<script type="module" src="/assets/index-Abc.js"></script>' +
  '<link rel="stylesheet" href="/assets/index-Xyz.css">' +
  '</head><body><div id="root"></div></body></html>';

describe('buildWebviewHtml', () => {
  it('keeps a path separator between the base dir and assets (asWebviewUri yields no trailing slash)', () => {
    // asWebviewUri() stringifies a directory URI WITHOUT a trailing slash.
    const baseUri = 'https://file+.vscode-resource.vscode-cdn.net/x/dist/webview';
    const out = buildWebviewHtml(SAMPLE_HTML, baseUri, 'https://csp.vscode-cdn.net');
    expect(out).toContain('dist/webview/assets/index-Abc.js');
    expect(out).toContain('dist/webview/assets/index-Xyz.css');
    expect(out).not.toContain('webviewassets/');
  });

  it('does not double the slash when base already ends with one', () => {
    const out = buildWebviewHtml(SAMPLE_HTML, 'https://host/x/dist/webview/', 'https://csp');
    expect(out).not.toContain('webview//assets');
    expect(out).toContain('webview/assets/index-Abc.js');
  });

  it('injects a Content-Security-Policy meta before </head>', () => {
    const out = buildWebviewHtml(SAMPLE_HTML, 'https://host/webview', 'https://csp');
    const cspIdx = out.indexOf('Content-Security-Policy');
    const headIdx = out.indexOf('</head>');
    expect(cspIdx).toBeGreaterThan(-1);
    expect(cspIdx).toBeLessThan(headIdx);
  });
});

describe('injectInitMeta', () => {
  // Simulate the browser's entity-decoding of getAttribute('content').
  function decodeAttr(raw: string): string {
    return raw
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }

  it('injects a jovaltus-init meta with models + defaultModelId, readable via parseInitMeta', () => {
    const out = injectInitMeta(SAMPLE_HTML, [{ id: 'gpt-5', provider: 'openai' }], 'gpt-5');
    const metaIdx = out.indexOf('name="jovaltus-init"');
    expect(metaIdx).toBeGreaterThan(-1);
    expect(metaIdx).toBeLessThan(out.indexOf('</head>'));

    const match = out.match(/name="jovaltus-init" content="([^"]*)"/);
    const raw = match?.[1];
    if (raw === undefined) throw new Error('init meta content not found');
    const result = parseInitMeta(decodeAttr(raw));
    expect(result).toEqual({
      models: [{ id: 'gpt-5', provider: 'openai' }],
      defaultModelId: 'gpt-5',
    });
  });

  it('escapes special characters so the content attribute stays intact and round-trips', () => {
    const out = injectInitMeta(SAMPLE_HTML, [{ id: 'a"b', provider: 'openai' }], 'a"b');
    // The content attribute is a single well-formed quoted span — no raw " breaks out
    const match = out.match(/<meta name="jovaltus-init" content="([^"]*)">/);
    expect(match).not.toBeNull();
    const raw = match?.[1];
    if (raw === undefined) throw new Error('init meta not found');
    const result = parseInitMeta(decodeAttr(raw));
    expect(result).toEqual({
      models: [{ id: 'a"b', provider: 'openai' }],
      defaultModelId: 'a"b',
    });
  });
});
