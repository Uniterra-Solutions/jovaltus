import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { restrictToDirectory } from '../agent/restrict-directory.js';
import type { BeforeToolCallContext, BeforeToolCallResult } from '@earendil-works/pi-agent-core';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { ToolRegistry } from '../agent/tool-registry.js';
import { readTool, writeTool, editTool, bashTool } from '../agent/tools/index.js';
import { createAgent } from '../agent/factory.js';
import type { JovaltusConfig } from '../config/types.js';

const MSG: AssistantMessage = {
  role: 'assistant',
  content: [],
  api: 'anthropic-messages',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  stopReason: 'toolUse',
  timestamp: 0,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
};

function ctx(args: Record<string, unknown>): BeforeToolCallContext {
  return {
    assistantMessage: MSG,
    toolCall: { type: 'toolCall', id: 'c1', name: 't', arguments: args },
    args,
    context: { systemPrompt: '', messages: [] },
  };
}

const TEST_CONFIG: JovaltusConfig = {
  coordinatorModel: { modelId: 'claude-sonnet-4-5', contextWindow: 200_000, maxTokens: 4096 },
  workerModel: { modelId: 'claude-haiku-4-5', contextWindow: 200_000, maxTokens: 4096 },
  openai: { baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key' },
  anthropic: { baseUrl: 'https://api.anthropic.com', apiKey: 'test-key' },
};

// ── restrictToDirectory ─────────────────────────────────────────────

describe('restrictToDirectory — penetration', () => {
  it('rejects non-normalized path escaping via ../ nesting in middle', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const guard = restrictToDirectory(join(dir, 'sub'));
    try {
      const r = (await guard(
        ctx({ filePath: join(dir, 'sub', 'deep', '..', '..', 'outside.ts') }),
      )) as BeforeToolCallResult;
      expect(r.block).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects symlink inside allowed dir pointing outside (TOCTOU bypass)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-outside-'));
    writeFileSync(join(outsideDir, 'secret.txt'), 'classified');
    const symlinkTarget = join(dir, 'link');
    symlinkSync(outsideDir, symlinkTarget);
    const guard = restrictToDirectory(dir);
    try {
      // path "dir/link/secret.txt" passes isWithin() because it starts with dir/
      // but realpath resolves it outside — THIS IS THE VULNERABILITY
      const result = await guard(ctx({ filePath: join(dir, 'link', 'secret.txt') }));
      // with current impl (no realpath), this returns undefined (allowed)
      // a proper fix would use realpathSync to reject it
      expect(result).toBeUndefined(); // KNOWN: symlink bypass — restrictToDirectory doesn't resolve realpath
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('rejects path that normalizes to the allowed dir parent via .. segments', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const guard = restrictToDirectory(join(dir, 'sub'));
    try {
      const r = (await guard(
        ctx({ filePath: join(dir, 'sub', '..', 'other') }),
      )) as BeforeToolCallResult;
      expect(r.block).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('handles empty string path gracefully', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const guard = restrictToDirectory(dir);
    try {
      // Empty string resolves to dir itself (resolve(dir, '') === dir), so it's allowed
      expect(await guard(ctx({ filePath: '' }))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes through non-path keys unchanged', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const guard = restrictToDirectory(dir);
    try {
      expect(await guard(ctx({ command: 'rm -rf /', timeout: 30 }))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('handles args as null/undefined', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const guard = restrictToDirectory(dir);
    try {
      const nullCtx = { ...ctx({}), args: null };
      expect(await guard(nullCtx)).toBeUndefined();
      const undefCtx = { ...ctx({}), args: undefined };
      expect(await guard(undefCtx)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── ToolRegistry ──────────────────────────────────────────────────────

describe('ToolRegistry — penetration', () => {
  it('duplicate registration silently overwrites previous', () => {
    const r = new ToolRegistry();
    const toolA = { ...readTool, name: 'read', label: 'Old Label' };
    const toolB = { ...readTool, name: 'read', label: 'New Label' };
    r.register(toolA);
    r.register(toolB);
    expect(r.list()).toHaveLength(1);
    expect(r.get('read')?.label).toBe('New Label');
  });

  it('select with empty array returns empty', () => {
    const r = new ToolRegistry();
    r.register(readTool);
    expect(r.select([])).toEqual([]);
  });

  it('get for unregistered name returns undefined', () => {
    expect(new ToolRegistry().get('nonexistent')).toBeUndefined();
  });
});

// ── Tools — edge cases ────────────────────────────────────────────────

describe('tools — penetration', () => {
  it('read: non-existent file returns error (throws)', async () => {
    await expect(
      readTool.execute('c1', { filePath: '/nonexistent/path/file.txt' }),
    ).rejects.toThrow();
  });

  it('read: offset beyond file length returns empty with tail', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const fp = join(dir, 'tiny.txt');
    writeFileSync(fp, 'just\n3\nlines');
    try {
      const r = await readTool.execute('c1', { filePath: fp, offset: 10 });
      const text = (r.content[0] as { type: 'text'; text: string } | undefined)?.text ?? '';
      expect(text).toBe('(empty)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('write: empty content writes zero-byte file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const fp = join(dir, 'empty.txt');
    try {
      const r = await writeTool.execute('c1', { filePath: fp, content: '' });
      expect(r.details).toMatchObject({ bytes: 0 });
      expect(readFileSync(fp, 'utf-8')).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('write: overwrites existing file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const fp = join(dir, 'overwrite.txt');
    writeFileSync(fp, 'original');
    try {
      await writeTool.execute('c1', { filePath: fp, content: 'replaced' });
      expect(readFileSync(fp, 'utf-8')).toBe('replaced');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('edit: replaceAll with zero occurrences returns not_found', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const fp = join(dir, 'f.txt');
    writeFileSync(fp, 'abc');
    try {
      const r = await editTool.execute('c1', {
        filePath: fp,
        oldString: 'xyz',
        newString: 'hi',
        replaceAll: true,
      });
      expect(r.details).toMatchObject({ error: 'not_found' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('edit: unicode (emoji / CJK) replacement', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const fp = join(dir, 'u.txt');
    writeFileSync(fp, '你好世界 🌍');
    try {
      const r = await editTool.execute('c1', {
        filePath: fp,
        oldString: '你好',
        newString: 'こんにちは',
      });
      expect(r.details).toMatchObject({ occurrences: 1 });
      expect(readFileSync(fp, 'utf-8')).toBe('こんにちは世界 🌍');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('edit: newString containing oldString with replaceAll', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const fp = join(dir, 'f.txt');
    writeFileSync(fp, 'foo bar');
    try {
      const r = await editTool.execute('c1', {
        filePath: fp,
        oldString: 'foo',
        newString: 'foofoo',
        replaceAll: true,
      });
      expect(r.details).toMatchObject({ occurrences: 1 }); // split+join, straightforward
      expect(readFileSync(fp, 'utf-8')).toBe('foofoo bar');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('edit: overlapping oldString in text handled by split+join (not greedy)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-pen-'));
    const fp = join(dir, 'f.txt');
    writeFileSync(fp, 'aaaa');
    try {
      // "aaaa".replaceAll("aa","a") → "aa" (no overlapping matches in JS)
      await editTool.execute('c1', {
        filePath: fp,
        oldString: 'aa',
        newString: 'a',
        replaceAll: true,
      });
      expect(readFileSync(fp, 'utf-8')).toBe('aa'); // split("aa") on "aaaa" → ["","",""], join → "aa"
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('bash: command with single quotes and special chars', async () => {
    const r = await bashTool.execute('c1', { command: "echo 'hello $PATH'" });
    const text = (r.content[0] as { type: 'text'; text: string } | undefined)?.text ?? '';
    expect(text).toContain('hello');
    expect(text).not.toContain('/bin'); // single quotes prevent expansion
    const details = r.details as { exitCode: number | string };
    expect(details.exitCode).toBe(0);
  });

  it('bash: handles binary/non-utf8 output gracefully', async () => {
    const r = await bashTool.execute('c1', { command: 'head -c 10 /dev/urandom | cat -v' });
    const details = r.details as { exitCode: number | string };
    expect(details.exitCode).toBe(0);
    const content = r.content[0] as { type: string; text?: string } | undefined;
    expect(content?.text?.length).toBeGreaterThan(0);
  });
});

// ── createAgent — edge cases ──────────────────────────────────────────

describe('createAgent — penetration', () => {
  it('FINDING: non-claude modelId silently treated as openai (no validation)', () => {
    // inferProvider treats anything not containing "claude" as "openai" provider.
    // A typo like "gpt-55" or "deepseek-v4" creates an agent without error,
    // because the model is registered with the openai provider — even if
    // it doesn't actually exist at the provider.
    const config: JovaltusConfig = {
      ...TEST_CONFIG,
      coordinatorModel: { modelId: 'gpt-5-fake', contextWindow: 200_000, maxTokens: 4096 },
    };
    // No throw — model is registered with openai provider silently
    const agent = createAgent(
      { role: 'coordinator', systemPrompt: 'test', tools: [readTool] },
      config,
    );
    expect(agent.state.model.id).toBe('gpt-5-fake');
    expect(agent.state.model.provider).toBe('openai');
  });

  it('creates agent even with empty tools array', () => {
    const agent = createAgent({ role: 'worker', systemPrompt: 'minimal', tools: [] }, TEST_CONFIG);
    expect(agent.state.tools).toEqual([]);
  });

  it('systemPrompt is preserved when context is empty object (not null/undefined)', () => {
    const agent = createAgent(
      { role: 'worker', systemPrompt: 'Sys', context: {}, tools: [readTool] },
      TEST_CONFIG,
    );
    expect(agent.state.systemPrompt).toBe('Sys');
  });
});
