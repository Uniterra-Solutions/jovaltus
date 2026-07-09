import { describe, it, expect } from 'vitest';
import { createAgent, createModelRegistry } from '../agent/factory.js';
import { readTool } from '../agent/tools/read.js';
import type { JovaltusConfig } from '../config/types.js';

const testConfig: JovaltusConfig = {
  coordinatorModel: { modelId: 'claude-sonnet-4-5', contextWindow: 200_000, maxTokens: 4096 },
  workerModel: { modelId: 'claude-haiku-4-5', contextWindow: 200_000, maxTokens: 4096 },
  openai: { baseUrl: 'https://api.openai.com/v1', apiKey: 'test-openai-key' },
  anthropic: { baseUrl: 'https://api.anthropic.com', apiKey: 'test-anthropic-key' },
};

describe('createAgent', () => {
  it('creates an agent with coordinator role', () => {
    const agent = createAgent(
      { role: 'coordinator', systemPrompt: 'You are a coordinator.', tools: [readTool] },
      testConfig,
    );
    expect(agent.state.systemPrompt).toContain('You are a coordinator.');
    expect(agent.state.model.id).toContain('sonnet');
  });

  it('creates an agent with worker role', () => {
    const agent = createAgent(
      { role: 'worker', systemPrompt: 'You are a worker.', tools: [readTool] },
      testConfig,
    );
    expect(agent.state.systemPrompt).toContain('You are a worker.');
    expect(agent.state.model.id).toContain('haiku');
  });

  it('injects context into system prompt', () => {
    const agent = createAgent(
      {
        role: 'worker',
        systemPrompt: 'Coder.',
        context: { filePaths: ['src/a.ts'], codeRanges: ['src/a.ts:10-20'], diff: '+fix' },
        tools: [readTool],
      },
      testConfig,
    );
    expect(agent.state.systemPrompt).toContain('src/a.ts');
    expect(agent.state.systemPrompt).toContain('src/a.ts:10-20');
    expect(agent.state.systemPrompt).toContain('+fix');
  });

  it('sets tools on the agent', () => {
    const agent = createAgent(
      { role: 'worker', systemPrompt: 'test', tools: [readTool] },
      testConfig,
    );
    expect(agent.state.tools).toHaveLength(1);
    expect(agent.state.tools[0]?.name).toBe('read');
  });
});

describe('createModelRegistry', () => {
  it('registers models from config', () => {
    const models = createModelRegistry(testConfig);
    const found = models.getModel('anthropic', 'claude-sonnet-4-5');
    expect(found).toBeDefined();
    expect(found?.id).toBe('claude-sonnet-4-5');
  });

  it('returns undefined for models not in config', () => {
    const models = createModelRegistry(testConfig);
    expect(models.getModel('anthropic', 'claude-opus-4-5')).toBeUndefined();
  });
});
