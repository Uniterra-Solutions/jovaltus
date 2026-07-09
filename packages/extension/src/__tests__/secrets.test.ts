import { describe, it, expect, vi } from 'vitest';
import type { ExtensionContext } from 'vscode';

// Must mock vscode before importing secrets.ts
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
  ConfigurationTarget: { Global: 1 },
}));

import { JovaltusSecrets } from '../secrets.js';
import * as vscode from 'vscode';

function mockContext(
  get: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
): ExtensionContext {
  return {
    secrets: { get, store: vi.fn(), delete: vi.fn(), onDidChange: vi.fn() },
  } as unknown as ExtensionContext;
}

describe('JovaltusSecrets.getApiKey', () => {
  it('returns undefined when no key stored', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const secrets = new JovaltusSecrets(mockContext(get));
    await expect(secrets.getApiKey('openai')).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledWith('jovaltus.openai.apiKey');
  });

  it('returns stored key for openai', async () => {
    const get = vi.fn().mockResolvedValue('sk-test-key');
    const secrets = new JovaltusSecrets(mockContext(get));
    await expect(secrets.getApiKey('openai')).resolves.toBe('sk-test-key');
  });

  it('returns stored key for anthropic', async () => {
    const get = vi.fn().mockResolvedValue('ant-test-key');
    const secrets = new JovaltusSecrets(mockContext(get));
    await expect(secrets.getApiKey('anthropic')).resolves.toBe('ant-test-key');
    expect(get).toHaveBeenCalledWith('jovaltus.anthropic.apiKey');
  });
});

describe('JovaltusSecrets.migrateFromConfig', () => {
  it('skips migration when key already in SecretStorage', async () => {
    const get = vi.fn().mockResolvedValue('existing-secret');
    const store = vi.fn();
    const ctx = mockContext(get);
    (ctx.secrets as ReturnType<typeof mockContext>['secrets'] & { store: typeof store }).store =
      store;

    const secrets = new JovaltusSecrets(ctx);
    await secrets.migrateFromConfig();
    expect(store).not.toHaveBeenCalled();
  });

  it('migrates openai key from plaintext config to SecretStorage', async () => {
    // SecretStorage is empty for both providers
    const get = vi.fn().mockResolvedValue(undefined);
    const store = vi.fn();
    const ctx = mockContext(get);
    (ctx.secrets as ReturnType<typeof mockContext>['secrets'] & { store: typeof store }).store =
      store;

    // Config has a plaintext key
    const configGet = vi.fn().mockReturnValue('sk-plaintext');
    const configUpdate = vi.fn();
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: configGet,
      update: configUpdate,
    } as unknown as ReturnType<typeof vscode.workspace.getConfiguration>);

    const secrets = new JovaltusSecrets(ctx);
    await secrets.migrateFromConfig();

    expect(store).toHaveBeenCalledWith('jovaltus.openai.apiKey', 'sk-plaintext');
  });

  it('does not migrate when config has no plaintext key', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const store = vi.fn();
    const ctx = mockContext(get);
    (ctx.secrets as ReturnType<typeof mockContext>['secrets'] & { store: typeof store }).store =
      store;

    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      update: vi.fn(),
    } as unknown as ReturnType<typeof vscode.workspace.getConfiguration>);

    const secrets = new JovaltusSecrets(ctx);
    await secrets.migrateFromConfig();
    expect(store).not.toHaveBeenCalled();
  });
});
