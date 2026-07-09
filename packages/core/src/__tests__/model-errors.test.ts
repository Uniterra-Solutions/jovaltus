import { describe, it, expect } from 'vitest';
import { ModelError, statusToCode, parseRetryAfter, classifyError } from '../model/errors.js';

describe('ModelError (item 8)', () => {
  it('is an instance of Error', () => {
    const err = new ModelError('auth failed', 'AUTH_ERROR', 'openai');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ModelError);
  });

  it('exposes code, provider, and optional fields', () => {
    const err = new ModelError('rate limited', 'RATE_LIMIT', 'openai', {
      statusCode: 429,
      retryAfterMs: 3000,
    });

    expect(err.code).toBe('RATE_LIMIT');
    expect(err.provider).toBe('openai');
    expect(err.statusCode).toBe(429);
    expect(err.retryAfterMs).toBe(3000);
    expect(err.message).toBe('rate limited');
    expect(err.name).toBe('ModelError');
  });

  it('defaults optional fields to undefined', () => {
    const err = new ModelError('timeout', 'TIMEOUT', 'anthropic');

    expect(err.statusCode).toBeUndefined();
    expect(err.retryAfterMs).toBeUndefined();
  });
});

describe('statusToCode', () => {
  it('maps 401/403 to AUTH_ERROR', () => {
    expect(statusToCode(401)).toBe('AUTH_ERROR');
    expect(statusToCode(403)).toBe('AUTH_ERROR');
  });

  it('maps 429 to RATE_LIMIT', () => {
    expect(statusToCode(429)).toBe('RATE_LIMIT');
  });

  it('maps 400 to INVALID_REQUEST', () => {
    expect(statusToCode(400)).toBe('INVALID_REQUEST');
  });

  it('maps other codes to PROVIDER_ERROR', () => {
    expect(statusToCode(500)).toBe('PROVIDER_ERROR');
    expect(statusToCode(undefined)).toBe('PROVIDER_ERROR');
    expect(statusToCode(502)).toBe('PROVIDER_ERROR');
  });
});

describe('parseRetryAfter', () => {
  it('parses retry-after header in seconds, returns ms', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
  });

  it('returns undefined for null/empty/NaN', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('abc')).toBeUndefined();
  });
});

describe('classifyError', () => {
  it('detects timeout errors by name', () => {
    const err = classifyError(
      Object.assign(new Error('ETIMEDOUT'), { name: 'TimeoutError' }),
      'openai',
    );
    expect(err.code).toBe('TIMEOUT');
  });

  it('detects timeout errors by message', () => {
    const err = classifyError(new Error('Request timed out after 30s'), 'openai');
    expect(err.code).toBe('TIMEOUT');
  });

  it('detects network errors', () => {
    for (const msg of [
      'fetch failed',
      'network error',
      'connect ECONNREFUSED',
      'getaddrinfo ENOTFOUND',
    ]) {
      const err = classifyError(new Error(msg), 'openai');
      expect(err.code).toBe('NETWORK_ERROR');
    }
  });

  it('defaults to PROVIDER_ERROR for unknown errors', () => {
    const err = classifyError(new Error('something unexpected'), 'openai');
    expect(err.code).toBe('PROVIDER_ERROR');
    expect(err.provider).toBe('openai');
  });
});
