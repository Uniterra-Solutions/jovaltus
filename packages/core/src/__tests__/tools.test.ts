import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readTool } from '../agent/tools/read.js';
import { writeTool } from '../agent/tools/write.js';
import { editTool } from '../agent/tools/edit.js';
import { bashTool } from '../agent/tools/bash.js';

function text(r: { content: { type: string; text?: string }[] }): string {
  return r.content[0]?.text ?? '';
}

describe('read tool', () => {
  it('reads file contents', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
    const fp = join(dir, 'test.txt');
    writeFileSync(fp, 'line one\nline two\nline three\n');
    try {
      const r = await readTool.execute('c1', { filePath: fp });
      expect(text(r)).toContain('line one');
      expect(text(r)).toContain('line three');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports offset and limit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
    const fp = join(dir, 'test.txt');
    writeFileSync(fp, Array.from({ length: 10 }, (_, i) => `line ${String(i + 1)}`).join('\n'));
    try {
      const r = await readTool.execute('c1', { filePath: fp, offset: 3, limit: 2 });
      expect(text(r)).toContain('line 4');
      expect(text(r)).toContain('line 5');
      expect(text(r)).not.toContain('line 1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('write tool', () => {
  it('writes content to a new file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
    const fp = join(dir, 'output.txt');
    try {
      const r = await writeTool.execute('c1', { filePath: fp, content: 'hello world' });
      const { readFileSync } = await import('node:fs');
      expect(readFileSync(fp, 'utf-8')).toBe('hello world');
      expect(r.details).toMatchObject({ bytes: 11 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates parent directories', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
    const fp = join(dir, 'sub', 'deep', 'out.txt');
    try {
      await writeTool.execute('c1', { filePath: fp, content: 'nested' });
      const { readFileSync } = await import('node:fs');
      expect(readFileSync(fp, 'utf-8')).toBe('nested');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('edit tool', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('replaces a single occurrence', async () => {
    dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
    const fp = join(dir, 'edit.txt');
    writeFileSync(fp, 'hello world');
    const r = await editTool.execute('c1', {
      filePath: fp,
      oldString: 'world',
      newString: 'universe',
    });
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(fp, 'utf-8')).toBe('hello universe');
    expect(r.details).toMatchObject({ occurrences: 1 });
  });

  it('replaces all with replaceAll', async () => {
    dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
    const fp = join(dir, 'edit.txt');
    writeFileSync(fp, 'foo bar foo baz foo');
    await editTool.execute('c1', {
      filePath: fp,
      oldString: 'foo',
      newString: 'qux',
      replaceAll: true,
    });
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(fp, 'utf-8')).toBe('qux bar qux baz qux');
  });

  it('errors when oldString not found', async () => {
    dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
    const fp = join(dir, 'edit.txt');
    writeFileSync(fp, 'hello world');
    const r = await editTool.execute('c1', { filePath: fp, oldString: 'nope', newString: 'x' });
    expect(r.details).toMatchObject({ error: 'not_found' });
  });

  it('errors when oldString is ambiguous', async () => {
    dir = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
    const fp = join(dir, 'edit.txt');
    writeFileSync(fp, 'foo bar foo');
    const r = await editTool.execute('c1', { filePath: fp, oldString: 'foo', newString: 'qux' });
    expect(r.details).toMatchObject({ error: 'ambiguous' });
  });
});

describe('bash tool', () => {
  it('executes a command and returns output', async () => {
    const r = await bashTool.execute('c1', { command: 'echo hello' });
    expect(text(r)).toContain('hello');
    expect(r.details).toMatchObject({ exitCode: 0 });
  });

  it('captures stderr', async () => {
    const r = await bashTool.execute('c1', { command: 'echo error >&2' });
    expect(text(r)).toContain('error');
  });

  it('handles non-zero exit', async () => {
    const r = await bashTool.execute('c1', { command: 'exit 42' });
    expect(r.details).toMatchObject({ exitCode: 42 });
  });
});
