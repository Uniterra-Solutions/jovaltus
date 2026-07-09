const DEFAULT_CONTEXT_WINDOW = 200_000;

export async function discoverContextWindow(
  providerUrl: string,
  apiKey: string,
  modelId: string,
): Promise<number | null> {
  try {
    const url = `${providerUrl.replace(/\/+$/, '')}/models`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(url, { headers });
    if (!response.ok) return null;

    const body = (await response.json()) as { readonly data?: unknown };
    if (!Array.isArray(body.data)) return null;

    const list = body.data as ReadonlyArray<Record<string, unknown>>;
    const match = list.find((m) => m['id'] === modelId);
    if (!match) return null;

    const window = match['context_window'] ?? match['context_length'] ?? match['max_input_tokens'];
    return typeof window === 'number' ? window : null;
  } catch {
    return null;
  }
}

export async function resolveContextWindow(
  modelId: string,
  manualSetting: number | 'auto',
  providerUrl: string,
  apiKey: string,
): Promise<number> {
  if (typeof manualSetting === 'number') return manualSetting;

  const discovered = await discoverContextWindow(providerUrl, apiKey, modelId);
  if (discovered !== null) return discovered;

  return DEFAULT_CONTEXT_WINDOW;
}
