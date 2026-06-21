export { createAgentTask } from './index-task.js';
export type { AgentTask } from './index-task.js';

// Tool Registry (Issue #3)
export {
  createReadState,
  createReadTool,
  createWriteTool,
  createEditTool,
  createBashTool,
  createToolRegistry,
} from './tools/index.js';
export type {
  ReadState,
  ToolDefinition,
  ToolParameterSchema,
  ToolHandler,
  ToolContext,
  Tool,
  ToolRegistry,
  ToolResult,
  ToolError,
  ToolErrorCode,
} from './tools/types.js';

// Context Injection (Issue #4)
export { createContextComposer } from './context/index.js';
export type {
  ContextProvider,
  ContextComposer,
  ContextComposerOptions,
  AgentContext,
  MemoryContext,
  MemoryContextEntry,
  SkillsContext,
  SkillsContextEntry,
  ToolDescriptor,
  ToolDescriptions,
  MCPContext,
} from './context/types.js';
