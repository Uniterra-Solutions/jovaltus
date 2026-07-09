import type { JovaltusConfig } from './types.js';

export const DEFAULT_CONFIG: Readonly<JovaltusConfig> = {
  coordinatorModel: {
    modelId: 'claude-sonnet-4-5',
    contextWindow: 'auto',
    maxTokens: 4096,
  },
  workerModel: {
    modelId: 'claude-haiku-4-5',
    contextWindow: 'auto',
    maxTokens: 4096,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
  },
};
