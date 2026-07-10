import type { ConfigProvider, JovaltusConfig, ModelConfig, ProviderConfig } from './types.js';
import { DEFAULT_CONFIG, PROVIDER_DEFAULT_BASE_URLS } from './defaults.js';
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
    const provider: 'openai' | 'anthropic' =
      this.overrides.provider ?? this.provider.get('jovaltus.provider', DEFAULT_CONFIG.provider);
    // Empty baseUrl falls back to the selected provider's standard endpoint.
    const baseUrl =
      (this.overrides.baseUrl ?? this.provider.get('jovaltus.baseUrl', '')) ||
      PROVIDER_DEFAULT_BASE_URLS[provider];

    return {
      provider,
      baseUrl,
      apiKey: this.overrides.apiKey ?? this.provider.get('jovaltus.apiKey', DEFAULT_CONFIG.apiKey),
      coordinatorModel: this.resolveModelConfig('coordinatorModel'),
      workerModel: this.resolveModelConfig('workerModel'),
    };
  }

  public getProviderConfig(): ProviderConfig {
    const config = this.getConfig();
    return { baseUrl: config.baseUrl, apiKey: config.apiKey };
  }

  public async resolveModelContextWindow(modelConfig: ModelConfig): Promise<number> {
    const { baseUrl, apiKey } = this.getProviderConfig();
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
