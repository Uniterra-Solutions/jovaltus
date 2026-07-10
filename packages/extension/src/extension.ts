import * as vscode from 'vscode';
import { ChatPanelProvider } from './chat-panel.js';
import { VSCodeConfigProvider } from './config-provider.js';
import { JovaltusSecrets } from './secrets.js';

export function activate(context: vscode.ExtensionContext): void {
  const secrets = new JovaltusSecrets(context);
  void secrets.migrateFromConfig();

  // Eager-load the API key so config provider has it synchronously
  const secretKeys = new Map<string, string>();
  void secrets.getApiKey().then((k) => {
    if (k) secretKeys.set('apiKey', k);
  });

  const provider = new ChatPanelProvider(
    new VSCodeConfigProvider(secretKeys),
    context.extensionUri,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('jovaltus.chatPanel', provider),
  );
}

export function deactivate(): void {}
