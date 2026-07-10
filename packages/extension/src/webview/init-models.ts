/** A model option shown in the chat model selector. */
export interface ModelOption {
  readonly id: string;
  readonly provider: string;
}

/** Models + default selection injected by the host into the webview HTML. */
export interface InitModels {
  readonly models: readonly ModelOption[];
  readonly defaultModelId: string;
}

function isModelOption(value: unknown): value is ModelOption {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { provider?: unknown }).provider === 'string'
  );
}

/**
 * Parse the `jovaltus-init` meta content (JSON: `{ models, defaultModelId }`).
 * Returns null if absent or malformed so the webview can degrade gracefully.
 * Pure & testable — takes the raw content string, no DOM access.
 */
export function parseInitMeta(content: string | null | undefined): InitModels | null {
  if (!content) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { models?: unknown }).models) ||
    typeof (parsed as { defaultModelId?: unknown }).defaultModelId !== 'string'
  ) {
    return null;
  }
  const models = (parsed as { models: unknown[] }).models.filter(isModelOption);
  return {
    models,
    defaultModelId: (parsed as { defaultModelId: string }).defaultModelId,
  };
}
