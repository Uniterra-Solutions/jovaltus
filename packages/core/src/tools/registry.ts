import type { Tool, ToolRegistry, ToolResult } from './types.js';

// ---------------------------------------------------------------------------
// Registry – a toolkit of named tools.
// ---------------------------------------------------------------------------

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, Tool>();
  const toolsByName = new Map<string, Tool>();

  const registry: ToolRegistry = {
    register(tool: Tool): void {
      const id = tool.definition.id;
      if (tools.has(id)) {
        throw new Error(`Tool '${id}' is already registered.`);
      }
      const name = tool.definition.name;
      if (toolsByName.has(name)) {
        throw new Error(`Tool name '${name}' is already registered.`);
      }
      tools.set(id, tool);
      toolsByName.set(name, tool);
    },

    get(id: string): Tool | undefined {
      return tools.get(id);
    },

    getByName(name: string): Tool | undefined {
      return toolsByName.get(name);
    },

    list(): readonly Tool[] {
      return [...tools.values()];
    },

    async execute(
      id: string,
      params: Readonly<Record<string, unknown>>,
      context,
    ): Promise<ToolResult> {
      const tool = tools.get(id);
      if (!tool) {
        return {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `No tool registered with id '${id}'.`,
          },
        };
      }

      try {
        return await tool.handler(params, context);
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: `Unexpected error executing tool '${id}': ${String(err)}`,
            details: err,
          },
        };
      }
    },
  };

  return registry;
}
