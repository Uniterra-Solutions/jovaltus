import type { CompletionRequest, CompletionResponse } from './types.js';
import type { ProviderConfig } from '../config/types.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';

export interface ModelClient {
  readonly provider: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  abort(): void;
}

export function createModelClient(
  protocol: 'openai' | 'anthropic',
  config: ProviderConfig,
  modelId: string,
): ModelClient {
  switch (protocol) {
    case 'openai':
      return new OpenAIProvider(config, modelId);
    case 'anthropic':
      return new AnthropicProvider(config, modelId);
  }
}
