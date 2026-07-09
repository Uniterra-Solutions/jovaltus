import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CompletionRequest, CompletionResponse } from '../model/types.js';
import type { ProviderConfig } from '../config/types.js';

// ---------------------------------------------------------------------------
// Hoisted mock refs for SDK internals
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  oaiCreate: vi.fn(),
  antCreate: vi.fn(),
}));

vi.mock('openai', () => {
  class MockOpenAI {
    static APIError = class extends Error {};
    chat = { completions: { create: mocks.oaiCreate } };
  }
  return { default: MockOpenAI };
});

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    static APIError = class extends Error {};
    messages = { create: mocks.antCreate };
  }
  return { default: MockAnthropic };
});

// Must import AFTER mocks
import { OpenAIProvider } from '../model/openai-provider.js';
import { AnthropicProvider } from '../model/anthropic-provider.js';
import { ModelError } from '../model/errors.js';

const dummyConfig: ProviderConfig = { baseUrl: 'https://test.example.com', apiKey: 'sk-test' };
const baseRequest: CompletionRequest = {
  model: 'test-model',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello.' },
  ],
};

function oaiResponse(content: string | null, finishReason = 'stop'): Record<string, unknown> {
  return {
    choices: [{ message: { content, role: 'assistant' }, finish_reason: finishReason }],
    usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
  };
}

function antResponse(text: string, stopReason = 'end_turn'): Record<string, unknown> {
  return {
    content: [{ type: 'text', text }],
    stop_reason: stopReason,
    usage: { input_tokens: 15, output_tokens: 5 },
  };
}

beforeEach(() => {
  mocks.oaiCreate.mockReset();
  mocks.antCreate.mockReset();
});

// ---------------------------------------------------------------------------
// Item 6 — OpenAI protocol complete()
// ---------------------------------------------------------------------------
describe('OpenAIProvider.complete() (item 6)', () => {
  it('constructs correct request body', async () => {
    mocks.oaiCreate.mockResolvedValue(oaiResponse('Hi!'));

    const provider = new OpenAIProvider(dummyConfig, 'gpt-4o');
    await provider.complete(baseRequest);

    expect(mocks.oaiCreate).toHaveBeenCalledOnce();
    const [body] = mocks.oaiCreate.mock.calls[0] as [
      { model: string; messages: unknown[]; max_tokens?: number; temperature?: number },
    ];
    expect(body.model).toBe('test-model');
    expect(body.max_tokens).toBeUndefined();
    expect(body.temperature).toBeUndefined();
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello.' },
    ]);
  });

  it('parses response into CompletionResponse', async () => {
    mocks.oaiCreate.mockResolvedValue(oaiResponse('Hello world'));

    const provider = new OpenAIProvider(dummyConfig, 'gpt-4o');
    const result: CompletionResponse = await provider.complete(baseRequest);

    expect(result.content).toBe('Hello world');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 3 });
  });

  it('handles null content (empty assistant reply)', async () => {
    mocks.oaiCreate.mockResolvedValue(oaiResponse(null, 'length'));

    const provider = new OpenAIProvider(dummyConfig, 'gpt-4o');
    const result = await provider.complete(baseRequest);

    expect(result.content).toBe('');
    expect(result.finishReason).toBe('length');
  });

  it('handles usage undefined (stream-style response without usage)', async () => {
    mocks.oaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'x', role: 'assistant' }, finish_reason: 'stop' }],
    });

    const provider = new OpenAIProvider(dummyConfig, 'gpt-4o');
    const result = await provider.complete(baseRequest);
    expect(result.usage).toBeUndefined();
  });

  it('throws PROVIDER_ERROR for empty choices array', async () => {
    mocks.oaiCreate.mockResolvedValue({ choices: [] });

    const provider = new OpenAIProvider(dummyConfig, 'gpt-4o');
    await expect(provider.complete(baseRequest)).rejects.toMatchObject({
      name: 'ModelError',
      code: 'PROVIDER_ERROR',
      provider: 'openai',
    });
  });
});

// ---------------------------------------------------------------------------
// Item 7 — Anthropic protocol complete()
// ---------------------------------------------------------------------------
describe('AnthropicProvider.complete() (item 7)', () => {
  it('separates system messages, sends non-system as messages', async () => {
    mocks.antCreate.mockResolvedValue(antResponse('Hey'));

    const provider = new AnthropicProvider(dummyConfig, 'claude-sonnet-4-5');
    await provider.complete(baseRequest);

    expect(mocks.antCreate).toHaveBeenCalledOnce();
    const [body] = mocks.antCreate.mock.calls[0] as [
      { model: string; system?: string; messages: unknown[]; max_tokens: number },
    ];
    expect(body.model).toBe('test-model');
    expect(body.system).toBe('You are helpful.');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello.' }]);
    expect(body.max_tokens).toBe(4096); // default when maxTokens not set
  });

  it('sends undefined system when no system role messages', async () => {
    mocks.antCreate.mockResolvedValue(antResponse('ok'));

    const provider = new AnthropicProvider(dummyConfig, 'mock-model');
    await provider.complete({
      model: 'x',
      messages: [{ role: 'user', content: 'hi' }],
    });

    const [body] = mocks.antCreate.mock.calls[0] as [{ system?: string }];
    expect(body.system).toBeUndefined();
  });

  it('parses text blocks, filters out non-text content', async () => {
    mocks.antCreate.mockResolvedValue({
      content: [
        { type: 'text', text: 'First para.' },
        { type: 'tool_use', id: 't1', name: 'search', input: {} },
        { type: 'text', text: 'Second para.' },
      ],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 20, output_tokens: 10 },
    });

    const provider = new AnthropicProvider(dummyConfig, 'claude-sonnet-4-5');
    const result = await provider.complete(baseRequest);

    expect(result.content).toBe('First para.\nSecond para.');
    expect(result.finishReason).toBe('max_tokens');
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
  });

  it('defaults stop_reason to "stop" when null', async () => {
    mocks.antCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: null,
      usage: { input_tokens: 2, output_tokens: 1 },
    });

    const provider = new AnthropicProvider(dummyConfig, 'mock-model');
    const result = await provider.complete({
      model: 'x',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.finishReason).toBe('stop');
  });
});

// ---------------------------------------------------------------------------
// Item 8 — Provider error mapping (classifyError fallback path)
// ---------------------------------------------------------------------------
describe('Provider error mapping (item 8 — complete() rejects with ModelError)', () => {
  it('OpenAI: maps generic Error through classifyError → NETWORK_ERROR', async () => {
    mocks.oaiCreate.mockRejectedValue(new Error('fetch failed'));

    const provider = new OpenAIProvider(dummyConfig, 'gpt-4o');
    await expect(provider.complete(baseRequest)).rejects.toMatchObject({
      name: 'ModelError',
      code: 'NETWORK_ERROR',
      provider: 'openai',
    });
  });

  it('Anthropic: maps generic Error through classifyError → NETWORK_ERROR', async () => {
    mocks.antCreate.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const provider = new AnthropicProvider(dummyConfig, 'claude-sonnet-4-5');
    await expect(provider.complete(baseRequest)).rejects.toMatchObject({
      name: 'ModelError',
      code: 'NETWORK_ERROR',
      provider: 'anthropic',
    });
  });

  it('OpenAI: maps unknown non-Error rejection to PROVIDER_ERROR', async () => {
    mocks.oaiCreate.mockRejectedValue('some string error');

    const provider = new OpenAIProvider(dummyConfig, 'gpt-4o');
    await expect(provider.complete(baseRequest)).rejects.toMatchObject({
      name: 'ModelError',
      code: 'PROVIDER_ERROR',
      provider: 'openai',
    });
  });

  it('Anthropic: maps unknown non-Error rejection to PROVIDER_ERROR', async () => {
    mocks.antCreate.mockRejectedValue(42);

    const provider = new AnthropicProvider(dummyConfig, 'claude-sonnet-4-5');
    await expect(provider.complete(baseRequest)).rejects.toMatchObject({
      name: 'ModelError',
      code: 'PROVIDER_ERROR',
      provider: 'anthropic',
    });
  });

  it('passes through ModelError unchanged (re-throw path)', async () => {
    const already = new ModelError('custom msg', 'AUTH_ERROR', 'openai');
    mocks.oaiCreate.mockRejectedValue(already);

    const provider = new OpenAIProvider(dummyConfig, 'gpt-4o');
    await expect(provider.complete(baseRequest)).rejects.toBe(already);
  });
});
