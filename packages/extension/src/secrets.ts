import * as vscode from 'vscode';

export class JovaltusSecrets {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getApiKey(): Promise<string | undefined> {
    return this.context.secrets.get('jovaltus.apiKey');
  }

  /** One-time: moves the API key from plaintext config into SecretStorage. */
  async migrateFromConfig(): Promise<void> {
    if (await this.getApiKey()) return;
    const config = vscode.workspace.getConfiguration('jovaltus');
    const plainKey = config.get<string>('apiKey');
    if (plainKey) {
      await this.context.secrets.store('jovaltus.apiKey', plainKey);
      await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
    }
  }
}
