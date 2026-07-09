export type {
  ConfigProvider,
  JovaltusConfig,
  ModelConfig,
  ProviderConfig,
} from './config/types.js';
export { DEFAULT_CONFIG } from './config/defaults.js';
export { ConfigManager } from './config/manager.js';
export { resolveContextWindow, discoverContextWindow } from './config/context-window.js';

export type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  TokenUsage,
} from './model/types.js';
export { ModelError, type ModelErrorCode } from './model/errors.js';
export type { ModelClient } from './model/client.js';
export { createModelClient } from './model/client.js';
export { OpenAIProvider } from './model/openai-provider.js';
export { AnthropicProvider } from './model/anthropic-provider.js';

// Agent
export type { AgentRole, AgentContext, CreateAgentOptions } from './agent/types.js';
export { createAgent, createModelRegistry } from './agent/factory.js';
export { ToolRegistry } from './agent/tool-registry.js';
export { restrictToDirectory } from './agent/restrict-directory.js';
export {
  readTool,
  writeTool,
  editTool,
  bashTool,
  READ_ONLY_TOOLS,
  READ_WRITE_TOOLS,
  VERIFY_TOOLS,
} from './agent/tools/index.js';

// Worktree
export { WorktreeManager } from './worktree/manager.js';
export { WorktreeError } from './worktree/types.js';
export type {
  WorktreeEntry,
  WorktreeCreateOptions,
  WorktreeMergeResult,
  WorktreeDeleteOptions,
  WorktreeErrorCode,
} from './worktree/types.js';

// Diff
export { CleanDiffManager } from './diff/manager.js';
export { DiffError } from './diff/types.js';
export type {
  DiffLevel,
  DiffFileEntry,
  DiffResult,
  DiffRequest,
  DiffErrorCode,
} from './diff/types.js';

// Planner
export { PlannerCore } from './planner/core.js';
export { PlannerError } from './planner/types.js';
export type { TaskInput, TaskNode, Batch, PlanResult, PlannerErrorCode } from './planner/types.js';

// Orchestrator
export { AgentModeOrchestrator } from './orchestrator/agent-mode.js';
export type {
  PhaseName,
  PhaseResult,
  AgentModeResult,
  AgentModeOptions,
  AgentModeEvent,
  VerificationItem,
  CheckPlan,
} from './orchestrator/types.js';
