import * as vscode from 'vscode';
import * as fs from 'node:fs';
import { ConfigManager, AgentModeOrchestrator } from '@jovaltus/core';
import type { AgentModeEvent, ConfigProvider } from '@jovaltus/core';

const PHASE_LABELS: Record<string, string> = {
  implementation: 'Implementing changes',
  planning: 'Distilling & planning',
  verification: 'Verifying & fixing',
  simplification: 'Simplifying code',
};

function loadWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const indexPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.html');
  let html = fs.readFileSync(indexPath.fsPath, 'utf-8');
  const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview'));
  html = html.replace(
    /(src|href)="\/assets\/([^"]+)"/g,
    (_match, attr: string, file: string) => `${attr}="${String(baseUri)}assets/${file}"`,
  );
  html = html.replace(
    '</head>',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource}; connect-src ${webview.cspSource};"></head>`,
  );
  return html;
}

export class ChatPanelProvider implements vscode.WebviewViewProvider {
  private selectedModelId: string | undefined;

  constructor(
    private readonly configProvider: ConfigProvider,
    private readonly extensionUri: vscode.Uri,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
    };
    webviewView.webview.html = loadWebviewHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage(
      (message: { readonly type: string; readonly text?: string; readonly modelId?: string }) => {
        if (message.type === 'userMessage' && message.text) {
          void this.handleUserMessage(message.text, webviewView);
        } else if (message.type === 'modelSwitch' && message.modelId) {
          this.selectedModelId = message.modelId;
        }
      },
    );
  }

  private async handleUserMessage(text: string, webview: vscode.WebviewView): Promise<void> {
    const configManager = new ConfigManager(
      this.configProvider,
      this.selectedModelId
        ? {
            coordinatorModel: { modelId: this.selectedModelId },
            workerModel: { modelId: this.selectedModelId },
          }
        : undefined,
    );

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.[0]) {
      void webview.webview.postMessage({
        type: 'agentError',
        phase: 'implementation',
        text: 'No workspace folder open.',
      });
      return;
    }

    const orchestrator = new AgentModeOrchestrator({
      repoPath: workspaceFolders[0].uri.fsPath,
      config: configManager.getConfig(),
    });

    void webview.webview.postMessage({
      type: 'assistantMessage',
      text: 'Starting agent mode task...',
    });

    orchestrator.onEvent((event: AgentModeEvent) => {
      this.forwardEvent(event, webview);
    });

    try {
      const result = await orchestrator.run(text);
      void webview.webview.postMessage({ type: 'agentComplete', summary: result.finalSummary });
    } catch (err: unknown) {
      void webview.webview.postMessage({
        type: 'agentError',
        phase: 'implementation',
        text: `Fatal error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  private forwardEvent(event: AgentModeEvent, webview: vscode.WebviewView): void {
    switch (event.type) {
      case 'phase_start':
        void webview.webview.postMessage({
          type: 'phaseStart',
          phase: event.phase,
          text: PHASE_LABELS[event.phase] ?? event.phase,
        });
        break;
      case 'phase_end':
        void webview.webview.postMessage({
          type: 'phaseEnd',
          phase: event.phase,
          status: event.result.status,
          text: event.result.summary,
        });
        break;
      case 'stream_delta':
        void webview.webview.postMessage({
          type: 'streamDelta',
          phase: event.phase,
          text: event.text,
        });
        break;
      case 'tool_call':
        void webview.webview.postMessage({
          type: 'toolCall',
          phase: event.phase,
          toolName: event.toolName,
          args: event.args,
        });
        break;
      case 'tool_result':
        break;
      case 'error':
        void webview.webview.postMessage({
          type: 'agentError',
          phase: event.phase,
          text: event.message,
        });
        break;
    }
  }
}
