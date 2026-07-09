import type { ConfigProvider, JovaltusConfig, ModelConfig, ProviderConfig } from './types.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { resolveContextWindow } from './context-window.js';

type DeepPartial<T> = {
  readonly [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export class ConfigManager {
  private readonly provider: ConfigProvider;
  private readonly overrides: DeepPartial<JovaltusConfig>;

  public constructor(provider: ConfigProvider, overrides?: DeepPartial<JovaltusConfig>) {
    this.provider = provider;
    this.overrides = overrides ?? {};
  }

  public getConfig(): JovaltusConfig {
    return {
      coordinatorModel: this.resolveModelConfig('coordinatorModel'),
      workerModel: this.resolveModelConfig('workerModel'),
      openai: this.getProviderConfig('openai'),
      anthropic: this.getProviderConfig('anthropic'),
    };
  }

  public getProviderConfig(protocol: 'openai' | 'anthropic'): ProviderConfig {
    const defaults = DEFAULT_CONFIG[protocol];
    const override = this.overrides[protocol];

    return {
      baseUrl:
        override?.baseUrl ?? this.provider.get(`jovaltus.${protocol}.baseUrl`, defaults.baseUrl),
      apiKey: override?.apiKey ?? this.provider.get(`jovaltus.${protocol}.apiKey`, defaults.apiKey),
    };
  }

  public async resolveModelContextWindow(
    modelConfig: ModelConfig,
    protocol: 'openai' | 'anthropic',
  ): Promise<number> {
    const { baseUrl, apiKey } = this.getProviderConfig(protocol);
    return resolveContextWindow(modelConfig.modelId, modelConfig.contextWindow, baseUrl, apiKey);
  }

  private resolveModelConfig(key: 'coordinatorModel' | 'workerModel'): ModelConfig {
    const defaults = DEFAULT_CONFIG[key];
    const override = this.overrides[key];

    return {
      modelId: override?.modelId ?? this.provider.get(`jovaltus.${key}.modelId`, defaults.modelId),
      contextWindow:
        override?.contextWindow ??
        this.provider.get(`jovaltus.${key}.contextWindow`, defaults.contextWindow),
      maxTokens:
        override?.maxTokens ?? this.provider.get(`jovaltus.${key}.maxTokens`, defaults.maxTokens),
    };
  }
}
