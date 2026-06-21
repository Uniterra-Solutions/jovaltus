import type {
  AgentContext,
  ContextComposer,
  ContextComposerOptions,
  ContextProvider,
  MemoryContext,
  MCPContext,
  SkillsContext,
  ToolDescriptions,
} from './types.js';

// ---------------------------------------------------------------------------
// Local / static providers (initial implementation)
// ---------------------------------------------------------------------------

/**
 * Default memory provider.
 * Returns an empty context when no external memory store is configured.
 */
function createMemoryProvider(): ContextProvider<MemoryContext | null> {
  return {
    type: 'memory',
    async get(): Promise<MemoryContext | null> {
      return null; // graceful degradation – no memory backend yet
    },
  };
}

/**
 * Default skills provider.
 * Returns an empty context when no skill registry is wired.
 */
function createSkillsProvider(): ContextProvider<SkillsContext | null> {
  return {
    type: 'skills',
    async get(): Promise<SkillsContext | null> {
      return null; // graceful degradation – no skills backend yet
    },
  };
}

/**
 * Tools provider.
 * Reads the tool registry and produces a description of every registered tool
 * without executing any of them.
 */
function createToolsProvider(
  registry?: ContextComposerOptions['toolRegistry'],
): ContextProvider<ToolDescriptions> {
  return {
    type: 'tools',
    async get(): Promise<ToolDescriptions> {
      if (!registry) {
        return { tools: [] };
      }

      const tools = registry.list().map((t) => ({
        id: t.definition.id,
        name: t.definition.name,
        description: t.definition.description,
        parameters: t.parameters,
      }));

      return { tools };
    },
  };
}

/**
 * Default MCP provider.
 * Returns an empty context when no MCP servers are configured.
 */
function createMCPProvider(): ContextProvider<MCPContext | null> {
  return {
    type: 'mcps',
    async get(): Promise<MCPContext | null> {
      return null; // graceful degradation – no MCP servers yet
    },
  };
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export function createContextComposer(
  providers?: {
    memory?: ContextProvider<MemoryContext | null>;
    skills?: ContextProvider<SkillsContext | null>;
    mcps?: ContextProvider<MCPContext | null>;
  },
): ContextComposer {
  const memoryProvider = providers?.memory ?? createMemoryProvider();
  const skillsProvider = providers?.skills ?? createSkillsProvider();
  const mcpProvider = providers?.mcps ?? createMCPProvider();

  return {
    async compose(options?: ContextComposerOptions): Promise<AgentContext> {
      const toolsProvider = createToolsProvider(options?.toolRegistry);

      const [memory, skills, tools, mcps] = await Promise.all([
        memoryProvider.get(),
        skillsProvider.get(),
        toolsProvider.get(),
        mcpProvider.get(),
      ]);

      return { memory, skills, tools, mcps };
    },
  };
}
