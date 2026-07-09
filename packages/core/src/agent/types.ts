import type { AgentTool } from '@earendil-works/pi-agent-core';

export type AgentRole = 'coordinator' | 'worker';

export interface AgentContext {
  readonly filePaths?: readonly string[];
  readonly codeRanges?: readonly string[];
  readonly diff?: string;
}

export interface CreateAgentOptions {
  readonly role: AgentRole;
  readonly systemPrompt: string;
  readonly context?: AgentContext;
  readonly tools: readonly AgentTool[];
}
