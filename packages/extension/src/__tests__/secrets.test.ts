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
  store: ReturnType<typeof vi.fn> = vi.fn(),
): ExtensionContext {
  return {
    secrets: { get, store, delete: vi.fn(), onDidChange: vi.fn() },
  } as unknown as ExtensionContext;
}

describe('JovaltusSecrets.getApiKey', () => {
  it('returns undefined when no key stored', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const secrets = new JovaltusSecrets(mockContext(get));
    await expect(secrets.getApiKey()).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledWith('jovaltus.apiKey');
  });

  it('returns stored key', async () => {
    const get = vi.fn().mockResolvedValue('sk-test-key');
    const secrets = new JovaltusSecrets(mockContext(get));
    await expect(secrets.getApiKey()).resolves.toBe('sk-test-key');
  });
});

describe('JovaltusSecrets.migrateFromConfig', () => {
  it('skips migration when key already in SecretStorage', async () => {
    const get = vi.fn().mockResolvedValue('existing-secret');
    const store = vi.fn();
    const secrets = new JovaltusSecrets(mockContext(get, store));
    await secrets.migrateFromConfig();
    expect(store).not.toHaveBeenCalled();
  });

  it('migrates plaintext key from config to SecretStorage', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const store = vi.fn();
    const configGet = vi.fn().mockReturnValue('sk-plaintext');
    const configUpdate = vi.fn();
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: configGet,
      update: configUpdate,
    } as unknown as ReturnType<typeof vscode.workspace.getConfiguration>);

    const secrets = new JovaltusSecrets(mockContext(get, store));
    await secrets.migrateFromConfig();

    expect(store).toHaveBeenCalledWith('jovaltus.apiKey', 'sk-plaintext');
    expect(configUpdate).toHaveBeenCalledWith(
      'apiKey',
      undefined,
      vscode.ConfigurationTarget.Global,
    );
  });

  it('does not migrate when config has no plaintext key', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const store = vi.fn();
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      update: vi.fn(),
    } as unknown as ReturnType<typeof vscode.workspace.getConfiguration>);

    const secrets = new JovaltusSecrets(mockContext(get, store));
    await secrets.migrateFromConfig();
    expect(store).not.toHaveBeenCalled();
  });
});
