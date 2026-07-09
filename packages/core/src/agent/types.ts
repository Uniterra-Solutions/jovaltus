import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { TSchema } from '@sinclair/typebox';

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
  /** When set, injects JSON output format into system prompt and
   *  enables structured output validation via {@link promptWithValidation}. */
  readonly outputSchema?: TSchema;
}
