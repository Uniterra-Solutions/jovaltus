import type { ToolParameterSchema } from '../tools/types.js';

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface ContextProvider<T = unknown> {
  /** Logical provider name, e.g. "memory", "skills". */
  readonly type: string;
  /** Return the context payload, or null / empty when unavailable. */
  get(): Promise<T>;
}

// ---------------------------------------------------------------------------
// Context payload types
// ---------------------------------------------------------------------------

export interface MemoryContextEntry {
  readonly name: string;
  readonly description: string;
  readonly content: string;
}

export interface MemoryContext {
  readonly items: readonly MemoryContextEntry[];
}

export interface SkillsContextEntry {
  readonly name: string;
  readonly description: string;
}

export interface SkillsContext {
  readonly items: readonly SkillsContextEntry[];
}

export interface ToolDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolParameterSchema;
}

export interface ToolDescriptions {
  readonly tools: readonly ToolDescriptor[];
}

export interface MCPContext {
  readonly servers: readonly {
    readonly name: string;
    readonly description: string;
    readonly toolCount: number;
  }[];
}

// ---------------------------------------------------------------------------
// Composed agent context
// ---------------------------------------------------------------------------

export interface AgentContext {
  readonly memory: MemoryContext | null;
  readonly skills: SkillsContext | null;
  readonly tools: ToolDescriptions;
  readonly mcps: MCPContext | null;
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export interface ContextComposerOptions {
  /** Tool provider needs a registry to enumerate tool definitions. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolRegistry?: { list(): readonly any[] };
}

export interface ContextComposer {
  compose(options?: ContextComposerOptions): Promise<AgentContext>;
}
