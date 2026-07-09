import {
  createModels,
  createProvider,
  type MutableModels,
  type Model,
  type Api,
} from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { Agent } from '@earendil-works/pi-agent-core';

import type { JovaltusConfig, ModelConfig } from '../config/types.js';
import type { CreateAgentOptions } from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────

function inferProvider(modelId: string): 'anthropic' | 'openai' {
  return modelId.toLowerCase().includes('claude') ? 'anthropic' : 'openai';
}

function toPiModel(mc: ModelConfig, provider: 'anthropic' | 'openai'): Model<Api> {
  return {
    id: mc.modelId,
    name: mc.modelId,
    api:
      provider === 'anthropic' ? ('anthropic-messages' as const) : ('openai-completions' as const),
    provider,
    baseUrl: '',
    reasoning: true,
    input: ['text'] as ('text' | 'image')[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: mc.contextWindow === 'auto' ? 200_000 : mc.contextWindow,
    maxTokens: mc.maxTokens,
  };
}

function formatContext(ctx: CreateAgentOptions['context']): string {
  if (!ctx) return '';
  const p: string[] = [];
  if (ctx.filePaths?.length)
    p.push('## Context Files\n' + ctx.filePaths.map((f) => `- ${f}`).join('\n'));
  if (ctx.codeRanges?.length)
    p.push('## Code Ranges\n' + ctx.codeRanges.map((r) => `- ${r}`).join('\n'));
  if (ctx.diff) p.push('## Diff Context\n```diff\n' + ctx.diff + '\n```');
  return p.length ? '\n\n' + p.join('\n\n') : '';
}

// ── Public API ───────────────────────────────────────────────────────

const APIS = { anthropic: anthropicMessagesApi(), openai: openAICompletionsApi() } as const;
const NAMES = { anthropic: 'Anthropic', openai: 'OpenAI' } as const;

export function createModelRegistry(config: JovaltusConfig): MutableModels {
  const models = createModels();
  const providers = { anthropic: config.anthropic, openai: config.openai } as const;
  const roleConfigs = [config.coordinatorModel, config.workerModel];

  for (const p of ['anthropic', 'openai'] as const) {
    const matched = roleConfigs.filter((mc) => inferProvider(mc.modelId) === p);
    if (!matched.length) continue;

    const pc = providers[p];
    models.setProvider(
      createProvider({
        id: p,
        name: NAMES[p],
        baseUrl: pc.baseUrl || undefined,
        auth: {
          apiKey: {
            name: `${NAMES[p]} API key`,
            resolve: () =>
              pc.apiKey
                ? Promise.resolve({ auth: { apiKey: pc.apiKey }, source: 'jovaltus config' })
                : Promise.resolve(undefined),
          },
        },
        models: matched.map((mc) => toPiModel(mc, p)),
        api: APIS[p],
      }),
    );
  }
  return models;
}

export function createAgent(options: CreateAgentOptions, config: JovaltusConfig): Agent {
  const modelConfig = options.role === 'coordinator' ? config.coordinatorModel : config.workerModel;
  const provider = inferProvider(modelConfig.modelId);

  const models = createModelRegistry(config);
  const model = models.getModel(provider, modelConfig.modelId);
  if (!model) {
    throw new Error(
      `Model "${modelConfig.modelId}" not found for provider "${provider}". ` +
        `Check Jovaltus settings.`,
    );
  }

  const systemPrompt = options.systemPrompt + formatContext(options.context);

  return new Agent({
    initialState: {
      systemPrompt,
      model,
      thinkingLevel: 'medium',
      tools: [...options.tools],
      messages: [],
    },
    streamFn: models.streamSimple.bind(models),
  });
}
