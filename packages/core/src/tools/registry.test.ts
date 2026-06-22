import { mkdtempSync, writeFileSync } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createBashTool } from './bash-tool.js';
import { createEditTool } from './edit-tool.js';
import { createReadState } from './read-state.js';
import { createReadTool } from './read-tool.js';
import { createToolRegistry } from './registry.js';
import type { ToolContext } from './types.js';
import { createWriteTool } from './write-tool.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temp directory and return its path together with a tool context. */
function setup(): { root: string; context: ToolContext } {
  const root = mkdtempSync(join(tmpdir(), 'jovaltus-test-'));
  const readState = createReadState(root);
  return { root, context: { workspaceRoot: root, readState } };
}

/** Register the four built-in tools in a fresh registry. */
function registryWithBuiltins() {
  const registry = createToolRegistry();
  registry.register(createReadTool());
  registry.register(createWriteTool());
  registry.register(createEditTool());
  registry.register(createBashTool());
  return registry;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe('ToolRegistry', () => {
  it('starts empty', () => {
    const r = createToolRegistry();
    expect(r.list()).toHaveLength(0);
  });

  it('registers and retrieves a tool by id', () => {
    const r = createToolRegistry();
    const tool = createReadTool();
    r.register(tool);
    expect(r.get('file_read')).toBe(tool);
  });

  it('lists all registered tools', () => {
    const r = registryWithBuiltins();
    const ids = r.list().map((t) => t.definition.id);
    expect(ids).toEqual(expect.arrayContaining(['file_read', 'file_write', 'file_edit', 'bash']));
    expect(r.list()).toHaveLength(4);
  });

  it('throws when registering a duplicate id', () => {
    const r = createToolRegistry();
    r.register(createReadTool());
    expect(() => { r.register(createReadTool()); }).toThrow("Tool 'file_read' is already registered");
  });

  it('returns undefined for an unknown tool', () => {
    const r = createToolRegistry();
    expect(r.get('nope')).toBeUndefined();
  });

  it('execute returns a structured error for unknown tools', async () => {
    const r = createToolRegistry();
    const { context } = setup();
    const result = await r.execute('nope', {}, context);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TOOL_NOT_FOUND');
  });

  it('retrieves a registered tool by name', () => {
    const r = createToolRegistry();
    const tool = createReadTool();
    r.register(tool);
    expect(r.getByName('Read')).toBe(tool);
  });

  it('returns undefined when looking up an unknown name', () => {
    const r = createToolRegistry();
    expect(r.getByName('nope')).toBeUndefined();
  });

  it('throws when registering a duplicate name', () => {
    const r = createToolRegistry();
    r.register({
      definition: { id: 'tool_a', name: 'DuplicateName', description: 'first' },
      parameters: { type: 'object', properties: {} },
      handler: () => Promise.resolve({ success: true }),
    });
    expect(() => {
      r.register({
        definition: { id: 'tool_b', name: 'DuplicateName', description: 'second' },
        parameters: { type: 'object', properties: {} },
        handler: () => Promise.resolve({ success: true }),
      });
    }).toThrow("Tool name 'DuplicateName' is already registered");
  });

  it('handler errors are caught and returned as structured errors', async () => {
    const r = createToolRegistry();
    r.register({
      definition: { id: 'crash', name: 'Crash', description: 'always throws' },
      parameters: { type: 'object', properties: {} },
      handler: () => Promise.reject(new Error('boom')),
    });
    const { context } = setup();
    const result = await r.execute('crash', {}, context);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNKNOWN_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Read tool
// ---------------------------------------------------------------------------

describe('Read tool', () => {
  it('reads a file and marks it as read', async () => {
    const { root, context } = setup();
    await mkdir(join(root, 'sub'), { recursive: true });
    await writeFile(join(root, 'sub', 'hello.txt'), 'hello world');

    const registry = createToolRegistry();
    registry.register(createReadTool());
    const result = await registry.execute('file_read', { filePath: 'sub/hello.txt' }, context);

    expect(result.success).toBe(true);
    expect(result.data).toBe('hello world');
    expect(context.readState.hasRead(join(root, 'sub', 'hello.txt'))).toBe(true);
  });

  it('returns an error when the file does not exist', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createReadTool());
    const result = await registry.execute('file_read', { filePath: 'missing.txt' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('READ_FAILED');
  });

  it('returns an error when filePath is empty', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createReadTool());
    const result = await registry.execute('file_read', { filePath: '' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
  });

  it('rejects ../ traversal outside the workspace and does not mark read state', async () => {
    const { root, context } = setup();
    const registry = createToolRegistry();
    registry.register(createReadTool());
    const result = await registry.execute('file_read', { filePath: '../outside.txt' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
    expect(context.readState.hasRead(join(root, '..', 'outside.txt'))).toBe(false);
  });

  it('accepts a path whose first segment begins with .. inside the workspace', async () => {
    const { root, context } = setup();
    const dir = join(root, '..foo');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'hello.txt'), 'hello world');

    const registry = createToolRegistry();
    registry.register(createReadTool());
    const result = await registry.execute('file_read', { filePath: '..foo/hello.txt' }, context);

    expect(result.success).toBe(true);
    expect(result.data).toBe('hello world');
    expect(context.readState.hasRead(join(root, '..foo', 'hello.txt'))).toBe(true);
  });

  it('rejects an absolute path outside the workspace', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createReadTool());
    const result = await registry.execute('file_read', { filePath: '/etc/passwd' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
    expect(context.readState.hasRead('/etc/passwd')).toBe(false);
  });

  it('succeeds with an absolute path inside the workspace', async () => {
    const { root, context } = setup();
    const absFile = join(root, 'in-workspace.txt');
    writeFileSync(absFile, 'hello');
    context.readState.markRead(absFile);

    const registry = createToolRegistry();
    registry.register(createReadTool());
    const result = await registry.execute('file_read', { filePath: absFile }, context);

    expect(result.success).toBe(true);
    expect(result.data).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// Write tool
// ---------------------------------------------------------------------------

describe('Write tool', () => {
  it('creates a new file', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createWriteTool());
    const result = await registry.execute('file_write', { filePath: 'new.txt', content: 'fresh' }, context);

    expect(result.success).toBe(true);
  });

  it('creates parent directories automatically', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createWriteTool());
    const result = await registry.execute('file_write', { filePath: 'a/b/c/deep.txt', content: 'deep' }, context);

    expect(result.success).toBe(true);
  });

  it('rejects writing to an existing file that has NOT been read', async () => {
    const { root, context } = setup();
    // Create the file first
    writeFileSync(join(root, 'existing.txt'), 'original');

    const registry = createToolRegistry();
    registry.register(createWriteTool());
    const result = await registry.execute('file_write', { filePath: 'existing.txt', content: 'overwrite' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FILE_NOT_READ');
  });

  it('allows writing to an existing file that HAS been read', async () => {
    const { root, context } = setup();
    writeFileSync(join(root, 'editable.txt'), 'original');

    // Read first
    context.readState.markRead(join(root, 'editable.txt'));

    const registry = createToolRegistry();
    registry.register(createWriteTool());
    const result = await registry.execute('file_write', { filePath: 'editable.txt', content: 'updated' }, context);

    expect(result.success).toBe(true);
  });

  it('returns an error when filePath is empty', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createWriteTool());
    const result = await registry.execute('file_write', { filePath: '', content: 'x' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
  });

  it('returns an error when content is not a string', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createWriteTool());
    const result = await registry.execute('file_write', { filePath: 'x.txt', content: 42 }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
  });

  it('rejects ../ traversal outside the workspace and does not create the outside file', async () => {
    const { root, context } = setup();
    const outsideTarget = join(root, '..', 'write-escape.txt');
    // Verify it does not exist yet
    await expect(access(outsideTarget)).rejects.toThrow();

    const registry = createToolRegistry();
    registry.register(createWriteTool());
    const result = await registry.execute('file_write', { filePath: '../write-escape.txt', content: 'should not be created' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
    // Verify the file was NOT created outside the workspace
    await expect(access(outsideTarget)).rejects.toThrow();
  });

  it('rejects an absolute path outside the workspace', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createWriteTool());
    const result = await registry.execute('file_write', { filePath: '/tmp/jovaltus-escape-test.txt', content: 'nope' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
  });
});

// ---------------------------------------------------------------------------
// Edit tool
// ---------------------------------------------------------------------------

describe('Edit tool', () => {
  it('replaces text in a file that has been read', async () => {
    const { root, context } = setup();
    const filePath = join(root, 'edit-me.txt');
    writeFileSync(filePath, 'hello world');
    context.readState.markRead(filePath);

    const registry = createToolRegistry();
    registry.register(createEditTool());
    const result = await registry.execute('file_edit', { filePath: 'edit-me.txt', oldString: 'world', newString: 'there' }, context);

    expect(result.success).toBe(true);
  });

  it('rejects edits to files that have not been read', async () => {
    const { root, context } = setup();
    writeFileSync(join(root, 'secret.txt'), 'secret');

    const registry = createToolRegistry();
    registry.register(createEditTool());
    const result = await registry.execute('file_edit', { filePath: 'secret.txt', oldString: 'secret', newString: 'public' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('FILE_NOT_READ');
  });

  it('returns an error when oldString is not found', async () => {
    const { root, context } = setup();
    const filePath = join(root, 'greeting.txt');
    writeFileSync(filePath, 'hello world');
    context.readState.markRead(filePath);

    const registry = createToolRegistry();
    registry.register(createEditTool());
    const result = await registry.execute('file_edit', { filePath: 'greeting.txt', oldString: 'nope', newString: 'x' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EDIT_FAILED');
  });

  it('returns an error when filePath is empty', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createEditTool());
    const result = await registry.execute('file_edit', { filePath: '', oldString: 'a', newString: 'b' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
  });

  it('returns an error when oldString is empty', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createEditTool());
    const result = await registry.execute('file_edit', { filePath: 'x.txt', oldString: '', newString: 'b' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
  });

  it('rejects outside-workspace paths before editing', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createEditTool());
    // Should fail with INVALID_PARAMS before even checking FILE_NOT_READ
    const result = await registry.execute('file_edit', { filePath: '../outside-edit.txt', oldString: 'a', newString: 'b' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
  });
});

// ---------------------------------------------------------------------------
// Bash tool
// ---------------------------------------------------------------------------

describe('Bash tool', () => {
  it('executes a command and returns its output', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createBashTool());
    const result = await registry.execute('bash', { command: 'echo hello' }, context);

    expect(result.success).toBe(true);
    expect(result.data).toBe('hello\n');
  });

  it('returns an error for an empty command', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createBashTool());
    const result = await registry.execute('bash', { command: '' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
  });

  it('returns an error when command fails', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createBashTool());
    const result = await registry.execute('bash', { command: 'false' }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EXECUTION_FAILED');
  });

  it('rejects an out-of-range timeoutMs with INVALID_PARAMS', async () => {
    const { context } = setup();
    const registry = createToolRegistry();
    registry.register(createBashTool());
    const result = await registry.execute('bash', { command: 'echo hello', timeoutMs: Number.MAX_SAFE_INTEGER }, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_PARAMS');
    expect(result.error?.message).toMatch(/timeoutMs/i);
  });
});
