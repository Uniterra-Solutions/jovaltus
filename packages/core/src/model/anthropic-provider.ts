import Anthropic from '@anthropic-ai/sdk';
import type { CompletionRequest, CompletionResponse } from './types.js';
import { ModelError, statusToCode, parseRetryAfter, classifyError } from './errors.js';
import type { ProviderConfig } from '../config/types.js';

export class AnthropicProvider {
  public readonly provider = 'anthropic';
  private readonly client: Anthropic;
  private controller: AbortController | null = null;

  public constructor(
    config: ProviderConfig,
    public readonly model: string,
  ) {
    this.client = new Anthropic({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });
  }

  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.controller = new AbortController();

    try {
      const systemMessages = request.messages.filter((m) => m.role === 'system');
      const nonSystemMessages = request.messages.filter((m) => m.role !== 'system');
      const system =
        systemMessages.length > 0 ? systemMessages.map((m) => m.content).join('\n') : undefined;

      const response = await this.client.messages.create(
        {
          model: request.model,
          system,
          messages: nonSystemMessages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          max_tokens: request.maxTokens ?? 4096,
        },
        { signal: this.controller.signal },
      );

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );

      return {
        content: textBlocks.map((b) => b.text).join('\n'),
        finishReason: response.stop_reason ?? 'stop',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error: unknown) {
      throw this.mapError(error);
    }
  }

  public abort(): void {
    this.controller?.abort();
    this.controller = null;
  }

  private mapError(error: unknown): ModelError {
    if (error instanceof ModelError) return error;

    if (error instanceof Anthropic.APIError) {
      const e = error as unknown as {
        readonly status?: number;
        readonly headers?: Record<string, string | null | undefined>;
        readonly message: string;
      };
      const code = statusToCode(e.status);
      return new ModelError(e.message, code, this.provider, {
        statusCode: e.status,
        retryAfterMs: parseRetryAfter(e.headers?.['retry-after'] ?? null),
      });
    }

    if (error instanceof DOMException && error.name === 'AbortError')
      return new ModelError('Request timed out', 'TIMEOUT', this.provider);

    return error instanceof Error
      ? classifyError(error, this.provider)
      : new ModelError('Unknown error', 'PROVIDER_ERROR', this.provider);
  }
}
