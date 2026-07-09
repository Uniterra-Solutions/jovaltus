import * as vscode from 'vscode';

type ApiProvider = 'openai' | 'anthropic';

export class JovaltusSecrets {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getApiKey(provider: ApiProvider): Promise<string | undefined> {
    return this.context.secrets.get(`jovaltus.${provider}.apiKey`);
  }

  /** One-time: moves API keys from plaintext config into SecretStorage. */
  async migrateFromConfig(): Promise<void> {
    for (const provider of ['openai', 'anthropic'] as const) {
      if (await this.getApiKey(provider)) continue;
      const config = vscode.workspace.getConfiguration('jovaltus');
      const plainKey = config.get<string>(`${provider}.apiKey`);
      if (plainKey) {
        await this.context.secrets.store(`jovaltus.${provider}.apiKey`, plainKey);
        await config.update(`${provider}.apiKey`, undefined, vscode.ConfigurationTarget.Global);
      }
    }
  }
}
