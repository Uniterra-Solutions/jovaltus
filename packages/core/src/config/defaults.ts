import type { JovaltusConfig } from './types.js';

/** Standard endpoint used when `jovaltus.baseUrl` is left empty. */
export const PROVIDER_DEFAULT_BASE_URLS: Readonly<Record<'openai' | 'anthropic', string>> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

export const DEFAULT_CONFIG: Readonly<JovaltusConfig> = {
  provider: 'anthropic',
  baseUrl: '',
  apiKey: '',
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
};
