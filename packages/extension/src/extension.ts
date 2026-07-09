import * as vscode from 'vscode';
import { ChatPanelProvider } from './chat-panel.js';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ChatPanelProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('jovaltus.chatPanel', provider),
  );
}

export function deactivate(): void {}
