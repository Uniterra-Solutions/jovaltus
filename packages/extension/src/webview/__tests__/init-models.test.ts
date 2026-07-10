import { describe, it, expect } from 'vitest';
import { parseInitMeta } from '../init-models.js';

describe('parseInitMeta', () => {
  it('parses a valid models payload', () => {
    const content = JSON.stringify({
      models: [
        { id: 'gpt-5', provider: 'openai' },
        { id: 'claude-x', provider: 'anthropic' },
      ],
      defaultModelId: 'gpt-5',
    });
    const result = parseInitMeta(content);
    expect(result).not.toBeNull();
    expect(result?.defaultModelId).toBe('gpt-5');
    expect(result?.models).toEqual([
      { id: 'gpt-5', provider: 'openai' },
      { id: 'claude-x', provider: 'anthropic' },
    ]);
  });

  it('returns null for empty / null / undefined content', () => {
    expect(parseInitMeta(null)).toBeNull();
    expect(parseInitMeta(undefined)).toBeNull();
    expect(parseInitMeta('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseInitMeta('not json')).toBeNull();
  });

  it('returns null when the shape is wrong', () => {
    expect(parseInitMeta(JSON.stringify({ models: [] }))).toBeNull(); // no defaultModelId
    expect(parseInitMeta(JSON.stringify({ defaultModelId: 'x' }))).toBeNull(); // no models
    expect(parseInitMeta(JSON.stringify({ models: 'notarray', defaultModelId: 'x' }))).toBeNull();
  });

  it('filters out malformed model entries but keeps valid ones', () => {
    const content = JSON.stringify({
      models: [
        { id: 'ok', provider: 'openai' },
        { id: 5, provider: 'openai' }, // id not a string
        { provider: 'x' }, // missing id
        null,
        'stray',
      ],
      defaultModelId: 'ok',
    });
    const result = parseInitMeta(content);
    expect(result?.models).toEqual([{ id: 'ok', provider: 'openai' }]);
  });
});
