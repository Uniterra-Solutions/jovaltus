export type ModelErrorCode =
  'AUTH_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'INVALID_REQUEST' | 'PROVIDER_ERROR' | 'NETWORK_ERROR';

export class ModelError extends Error {
  public readonly code: ModelErrorCode;
  public readonly statusCode?: number;
  public readonly retryAfterMs?: number;
  public readonly provider: string;

  public constructor(
    message: string,
    code: ModelErrorCode,
    provider: string,
    options?: { readonly statusCode?: number; readonly retryAfterMs?: number },
  ) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export function statusToCode(status: number | undefined): ModelErrorCode {
  if (status === 401 || status === 403) return 'AUTH_ERROR';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 400) return 'INVALID_REQUEST';
  return 'PROVIDER_ERROR';
}

export function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isNaN(seconds) ? undefined : seconds * 1000;
}

export function classifyError(error: Error, provider: string): ModelError {
  const msg = error.message;
  if (error.name === 'TimeoutError' || msg.includes('timeout') || msg.includes('timed out'))
    return new ModelError(error.message, 'TIMEOUT', provider);
  if (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND')
  )
    return new ModelError(error.message, 'NETWORK_ERROR', provider);
  return new ModelError(error.message, 'PROVIDER_ERROR', provider);
}
