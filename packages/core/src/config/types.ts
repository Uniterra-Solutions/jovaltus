export interface ProviderConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
}

export interface ModelConfig {
  readonly modelId: string;
  readonly contextWindow: number | 'auto';
  readonly maxTokens: number;
}

export interface JovaltusConfig {
  readonly provider: 'openai' | 'anthropic';
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly coordinatorModel: ModelConfig;
  readonly workerModel: ModelConfig;
}

export interface ConfigProvider {
  get<T>(section: string, defaultValue: T): T;
}
