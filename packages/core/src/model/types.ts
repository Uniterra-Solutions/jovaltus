export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface CompletionRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface CompletionResponse {
  readonly content: string;
  readonly usage?: TokenUsage;
  readonly finishReason: string;
}
