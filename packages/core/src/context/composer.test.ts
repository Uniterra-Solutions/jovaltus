import { describe, expect, it } from 'vitest';

import type {
  ContextProvider,
  MemoryContext,
  MCPContext,
  SkillsContext,
} from './types.js';

import { createContextComposer } from './composer.js';
import { createReadTool } from '../tools/read-tool.js';
import { createToolRegistry } from '../tools/registry.js';

// ---------------------------------------------------------------------------
// createContextComposer
// ---------------------------------------------------------------------------

describe('createContextComposer', () => {
  // -----------------------------------------------------------------------
  // Test 1: empty defaults
  // -----------------------------------------------------------------------

  it('returns empty default context when no providers or registry are configured', async () => {
    const composer = createContextComposer();
    const context = await composer.compose();

    expect(context.memory).toBeNull();
    expect(context.skills).toBeNull();
    expect(context.mcps).toBeNull();
    expect(context.tools.tools).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Test 2: custom providers + registered tool
  // -----------------------------------------------------------------------

  it('uses custom providers and describes registered tools', async () => {
    const memoryProvider: ContextProvider<MemoryContext | null> = {
      type: 'memory',
      get() {
        return Promise.resolve({
          items: [
            {
              name: 'project-context',
              description: 'Project information',
              content: 'jovaltus',
            },
          ],
        });
      },
    };

    const skillsProvider: ContextProvider<SkillsContext | null> = {
      type: 'skills',
      get() {
        return Promise.resolve({
          items: [{ name: 'file-read', description: 'Ability to read files' }],
        });
      },
    };

    const mcpProvider: ContextProvider<MCPContext | null> = {
      type: 'mcps',
      get() {
        return Promise.resolve({
          servers: [
            {
              name: 'filesystem',
              description: 'Local file system access',
              toolCount: 3,
            },
          ],
        });
      },
    };

    const registry = createToolRegistry();
    registry.register(createReadTool());

    const composer = createContextComposer({
      memory: memoryProvider,
      skills: skillsProvider,
      mcps: mcpProvider,
    });

    const context = await composer.compose({ toolRegistry: registry });

    // -- custom provider payloads -----------------------------------------

    expect(context.memory).toEqual({
      items: [
        {
          name: 'project-context',
          description: 'Project information',
          content: 'jovaltus',
        },
      ],
    });

    expect(context.skills).toEqual({
      items: [{ name: 'file-read', description: 'Ability to read files' }],
    });

    expect(context.mcps).toEqual({
      servers: [
        {
          name: 'filesystem',
          description: 'Local file system access',
          toolCount: 3,
        },
      ],
    });

    // -- tool descriptor --------------------------------------------------

    expect(context.tools.tools).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by toHaveLength above
    const readTool = context.tools.tools[0]!;
    expect(readTool.id).toBe('file_read');
    expect(readTool.name).toBe('Read');
    expect(readTool.description.length).toBeGreaterThan(0);
    expect(readTool.parameters.type).toBe('object');
  });

  // -----------------------------------------------------------------------
  // Test 3: handlers are NOT invoked during composition
  // -----------------------------------------------------------------------

  it('does not execute tool handlers while composing tool descriptions', async () => {
    let handlerCallCount = 0;

    const fakeRegistry = {
      list() {
        return [
          {
            definition: {
              id: 'test-tool',
              name: 'Test Tool',
              description: 'A test tool that should not be executed',
            },
            parameters: {
              type: 'object' as const,
              properties: {},
              required: [] as readonly string[],
              additionalProperties: false,
            },
            handler: () => {
              handlerCallCount++;
              return Promise.resolve({ success: true, data: null });
            },
          },
        ];
      },
    };

    const composer = createContextComposer();
    const context = await composer.compose({ toolRegistry: fakeRegistry });

    // -- tool metadata is still surfaced ----------------------------------

    expect(context.tools.tools).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by toHaveLength above
    const tool = context.tools.tools[0]!;
    expect(tool.id).toBe('test-tool');
    expect(tool.name).toBe('Test Tool');
    expect(tool.description).toBe('A test tool that should not be executed');
    expect(tool.parameters.type).toBe('object');

    // -- handler was never called -----------------------------------------

    expect(handlerCallCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Test 4: optional provider rejection degrades gracefully
  // -----------------------------------------------------------------------

  it('returns tool descriptions when memory, skills, and MCP providers reject', async () => {
    function rejectingProvider<T>(): ContextProvider<T> {
      return {
        type: 'rejecting',
        get(): Promise<T> {
          return Promise.reject(new Error('Provider unavailable'));
        },
      };
    }

    const registry = createToolRegistry();
    registry.register(createReadTool());

    const composer = createContextComposer({
      memory: rejectingProvider<MemoryContext | null>(),
      skills: rejectingProvider<SkillsContext | null>(),
      mcps: rejectingProvider<MCPContext | null>(),
    });

    const context = await composer.compose({ toolRegistry: registry });

    // Optional providers degrade to null
    expect(context.memory).toBeNull();
    expect(context.skills).toBeNull();
    expect(context.mcps).toBeNull();

    // Tool descriptions are still available
    expect(context.tools.tools).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const readTool = context.tools.tools[0]!;
    expect(readTool.id).toBe('file_read');
    expect(readTool.name).toBe('Read');
  });

  // -----------------------------------------------------------------------
  // Test 5: individual optional provider degradation
  // -----------------------------------------------------------------------

  it('degrades only the failing optional provider to null', async () => {
    const composer = createContextComposer({
      memory: {
        type: 'memory',
        get(): Promise<MemoryContext | null> {
          return Promise.reject(new Error('memory unavailable'));
        },
      },
      skills: {
        type: 'skills',
        get(): Promise<SkillsContext | null> {
          return Promise.resolve({
            items: [
              { name: 'file-read', description: 'Ability to read files' },
            ],
          });
        },
      },
    });

    const context = await composer.compose();

    expect(context.memory).toBeNull();
    expect(context.skills).toEqual({
      items: [{ name: 'file-read', description: 'Ability to read files' }],
    });
    expect(context.tools.tools).toEqual([]);
    expect(context.mcps).toBeNull();
  });
});
