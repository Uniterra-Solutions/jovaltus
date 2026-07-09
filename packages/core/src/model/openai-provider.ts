import OpenAI from 'openai';
import type { CompletionRequest, CompletionResponse } from './types.js';
import { ModelError, statusToCode, parseRetryAfter, classifyError } from './errors.js';
import type { ProviderConfig } from '../config/types.js';

export class OpenAIProvider {
  public readonly provider = 'openai';
  private readonly client: OpenAI;
  private controller: AbortController | null = null;

  public constructor(
    config: ProviderConfig,
    public readonly model: string,
  ) {
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });
  }

  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.controller = new AbortController();

    try {
      const response = await this.client.chat.completions.create(
        {
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: request.maxTokens,
          temperature: request.temperature,
        },
        { signal: this.controller.signal },
      );

      const choice = response.choices[0];
      if (!choice)
        throw new ModelError('No completion choice returned', 'PROVIDER_ERROR', this.provider);

      return {
        content: choice.message.content ?? '',
        finishReason: choice.finish_reason,
        usage: response.usage
          ? {
              inputTokens: response.usage.prompt_tokens,
              outputTokens: response.usage.completion_tokens,
            }
          : undefined,
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

    if (error instanceof OpenAI.APIError) {
      const e = error as unknown as {
        readonly status?: number;
        readonly headers?: Headers;
        readonly message: string;
      };
      const code = statusToCode(e.status);
      return new ModelError(e.message, code, this.provider, {
        statusCode: e.status,
        retryAfterMs: parseRetryAfter(e.headers?.get('retry-after') ?? null),
      });
    }

    if (error instanceof DOMException && error.name === 'AbortError')
      return new ModelError('Request timed out', 'TIMEOUT', this.provider);

    return error instanceof Error
      ? classifyError(error, this.provider)
      : new ModelError('Unknown error', 'PROVIDER_ERROR', this.provider);
  }
}
