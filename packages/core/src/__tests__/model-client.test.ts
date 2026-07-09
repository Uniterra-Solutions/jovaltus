import { describe, it, expect } from 'vitest';
import { createModelClient } from '../model/client.js';
import type { ProviderConfig } from '../config/types.js';

const dummyConfig: ProviderConfig = {
  baseUrl: 'https://example.com',
  apiKey: 'sk-dummy',
};

describe('createModelClient', () => {
  it('creates an OpenAI client for "openai" protocol', () => {
    const client = createModelClient('openai', dummyConfig, 'gpt-4o');

    expect(client.provider).toBe('openai');
    expect(client.model).toBe('gpt-4o');
    expect(typeof client.complete).toBe('function');
    expect(typeof client.abort).toBe('function');
  });

  it('creates an Anthropic client for "anthropic" protocol', () => {
    const client = createModelClient('anthropic', dummyConfig, 'claude-sonnet-4-5');

    expect(client.provider).toBe('anthropic');
    expect(client.model).toBe('claude-sonnet-4-5');
    expect(typeof client.complete).toBe('function');
    expect(typeof client.abort).toBe('function');
  });

  it('different providers yield different provider strings', () => {
    const openai = createModelClient('openai', dummyConfig, 'm1');
    const anthropic = createModelClient('anthropic', dummyConfig, 'm2');

    expect(openai.provider).not.toBe(anthropic.provider);
  });

  it('abort is idempotent (no-op when no request in flight)', () => {
    const client = createModelClient('openai', dummyConfig, 'gpt-4o');
    expect(() => {
      client.abort();
    }).not.toThrow();
    expect(() => {
      client.abort();
    }).not.toThrow(); // second call
  });
});
