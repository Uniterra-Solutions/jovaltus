import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../config/manager.js';
import type { ConfigProvider, ModelConfig } from '../config/types.js';
import { resolveContextWindow } from '../config/context-window.js';

function provider(map: Record<string, string | number>): ConfigProvider {
  return {
    get<T>(key: string, defaultValue: T): T {
      return (map[key] as T) ?? defaultValue;
    },
  };
}

describe('ConfigManager', () => {
  it('reads coordinator model settings (item 3)', () => {
    const mgr = new ConfigManager(
      provider({
        'jovaltus.coordinatorModel.modelId': 'custom-coordinator',
        'jovaltus.coordinatorModel.maxTokens': 8192,
      }),
    );

    const cfg = mgr.getConfig();
    expect(cfg.coordinatorModel.modelId).toBe('custom-coordinator');
    expect(cfg.coordinatorModel.maxTokens).toBe(8192);
    expect(cfg.coordinatorModel.contextWindow).toBe('auto');
  });

  it('reads worker model settings (item 3)', () => {
    const mgr = new ConfigManager(
      provider({
        'jovaltus.workerModel.modelId': 'custom-worker',
        'jovaltus.workerModel.contextWindow': 32000,
      }),
    );

    const cfg = mgr.getConfig();
    expect(cfg.workerModel.modelId).toBe('custom-worker');
    expect(cfg.workerModel.contextWindow).toBe(32000);
  });

  it('reads OpenAI base URL and API key (item 4)', () => {
    const mgr = new ConfigManager(
      provider({
        'jovaltus.openai.baseUrl': 'https://custom.openai.com/v1',
        'jovaltus.openai.apiKey': 'sk-test',
      }),
    );

    const cfg = mgr.getConfig();
    expect(cfg.openai.baseUrl).toBe('https://custom.openai.com/v1');
    expect(cfg.openai.apiKey).toBe('sk-test');
  });

  it('reads Anthropic base URL and API key (item 4)', () => {
    const mgr = new ConfigManager(
      provider({
        'jovaltus.anthropic.baseUrl': 'https://custom.anthropic.com',
        'jovaltus.anthropic.apiKey': 'ant-test',
      }),
    );

    const cfg = mgr.getConfig();
    expect(cfg.anthropic.baseUrl).toBe('https://custom.anthropic.com');
    expect(cfg.anthropic.apiKey).toBe('ant-test');
  });

  it('falls back to defaults when no provider values set', () => {
    const mgr = new ConfigManager(provider({}));
    const cfg = mgr.getConfig();

    expect(cfg.coordinatorModel.modelId).toBe('claude-sonnet-4-5');
    expect(cfg.workerModel.modelId).toBe('claude-haiku-4-5');
    expect(cfg.openai.baseUrl).toBe('https://api.openai.com/v1');
    expect(cfg.anthropic.baseUrl).toBe('https://api.anthropic.com');
  });

  it('programmatic overrides take highest priority', () => {
    const mgr = new ConfigManager(
      provider({ 'jovaltus.coordinatorModel.modelId': 'from-provider' }),
      { coordinatorModel: { modelId: 'from-override' } },
    );

    expect(mgr.getConfig().coordinatorModel.modelId).toBe('from-override');
  });

  it('resolves model context window with manual number override (item 5)', async () => {
    const modelConfig: ModelConfig = {
      modelId: 'unknown-model',
      contextWindow: 42_000,
      maxTokens: 2048,
    };

    const mgr = new ConfigManager(provider({}));
    const window = await mgr.resolveModelContextWindow(modelConfig, 'openai');
    expect(window).toBe(42_000);
  });
});

describe('resolveContextWindow', () => {
  it('returns manual value immediately when number is given (item 5)', async () => {
    const result = await resolveContextWindow('unknown-model', 65536, 'https://example.com', '');
    expect(result).toBe(65536);
  });

  it('returns default when auto-discovery fails for unknown model', async () => {
    // Using an unreachable port so fetch fails fast with ECONNREFUSED.
    const result = await resolveContextWindow(
      'unknown-model-xyz',
      'auto',
      'http://127.0.0.1:1',
      '',
    );
    expect(result).toBe(200_000);
  });
});
