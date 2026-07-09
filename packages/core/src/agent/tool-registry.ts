import type { AgentTool } from '@earendil-works/pi-agent-core';

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  list(): readonly AgentTool[] {
    return [...this.tools.values()];
  }

  select(names: readonly string[]): readonly AgentTool[] {
    return names.map((n) => this.tools.get(n)).filter((t): t is AgentTool => t != null);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }
}
