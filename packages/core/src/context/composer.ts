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
    get(): Promise<MemoryContext | null> {
      return Promise.resolve(null); // graceful degradation – no memory backend yet
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
    get(): Promise<SkillsContext | null> {
      return Promise.resolve(null); // graceful degradation – no skills backend yet
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
    get(): Promise<ToolDescriptions> {
      if (!registry) {
        return Promise.resolve({ tools: [] });
      }

      const tools = registry.list().map((t) => ({
        id: t.definition.id,
        name: t.definition.name,
        description: t.definition.description,
        parameters: t.parameters,
      }));

      return Promise.resolve({ tools });
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
    get(): Promise<MCPContext | null> {
      return Promise.resolve(null); // graceful degradation – no MCP servers yet
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

      // Wrap optional providers so individual rejections degrade to null
      // rather than failing the whole composition. Tool provider is
      // mandatory — its rejections propagate.
      const safeGet = async <T>(
        provider: ContextProvider<T | null>,
      ): Promise<T | null> => {
        try {
          return await provider.get();
        } catch {
          return null;
        }
      };

      const [memory, skills, tools, mcps] = await Promise.all([
        safeGet(memoryProvider),
        safeGet(skillsProvider),
        toolsProvider.get(),
        safeGet(mcpProvider),
      ]);

      return { memory, skills, tools, mcps };
    },
  };
}
