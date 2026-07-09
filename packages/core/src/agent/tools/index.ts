import type { AgentTool } from '@earendil-works/pi-agent-core';
import { readTool } from './read.js';
import { writeTool } from './write.js';
import { editTool } from './edit.js';
import { bashTool } from './bash.js';

export const READ_ONLY_TOOLS: readonly AgentTool[] = [readTool, bashTool];
export const READ_WRITE_TOOLS: readonly AgentTool[] = [readTool, writeTool, editTool, bashTool];
export const VERIFY_TOOLS: readonly AgentTool[] = [bashTool];

export { readTool, writeTool, editTool, bashTool };
