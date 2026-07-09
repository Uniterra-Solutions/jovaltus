import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { restrictToDirectory } from '../agent/restrict-directory.js';
import type { BeforeToolCallContext, BeforeToolCallResult } from '@earendil-works/pi-agent-core';
import type { AssistantMessage } from '@earendil-works/pi-ai';

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

describe('restrictToDirectory', () => {
  it('allows reads/writes within the directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-guard-'));
    try {
      writeFileSync(join(dir, 'a.ts'), '// ok');
      const guard = restrictToDirectory(dir);
      expect(await guard(ctx({ filePath: join(dir, 'a.ts') }))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects paths outside the directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-guard-'));
    const guard = restrictToDirectory(dir);
    try {
      const r = (await guard(
        ctx({ filePath: join(tmpdir(), 'outside.ts') }),
      )) as BeforeToolCallResult;
      expect(r.block).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects ../ escape', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-guard-'));
    const guard = restrictToDirectory(join(dir, 'sub'));
    try {
      const r = (await guard(ctx({ filePath: '../outside.ts' }))) as BeforeToolCallResult;
      expect(r.block).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('checks all known path keys', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-guard-'));
    const guard = restrictToDirectory(dir);
    const bad = join(tmpdir(), 'secret.txt');
    try {
      for (const key of ['filePath', 'path', 'targetPath', 'sourcePath']) {
        const r = (await guard(ctx({ [key]: bad }))) as BeforeToolCallResult;
        expect(r.block).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores non-path keys', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-guard-'));
    const guard = restrictToDirectory(dir);
    try {
      expect(await guard(ctx({ command: 'rm -rf /' }))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves relative paths against allowed dir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-guard-'));
    const guard = restrictToDirectory(dir);
    try {
      expect(await guard(ctx({ filePath: 'file.ts' }))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
