import * as vscode from 'vscode';
import type { ConfigProvider } from '@jovaltus/core';
import { ConfigManager, AgentModeOrchestrator } from '@jovaltus/core';
import type { AgentModeEvent } from '@jovaltus/core';

function getWebviewHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jovaltus Chat</title>
  <style>
    :root {
      --jovaltus-bg: var(--vscode-sideBar-background);
      --jovaltus-fg: var(--vscode-sideBar-foreground);
      --jovaltus-input-bg: var(--vscode-input-background);
      --jovaltus-input-fg: var(--vscode-input-foreground);
      --jovaltus-input-border: var(--vscode-input-border);
      --jovaltus-button-bg: var(--vscode-button-background);
      --jovaltus-button-fg: var(--vscode-button-foreground);
      --jovaltus-button-hover: var(--vscode-button-hoverBackground);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--jovaltus-bg);
      color: var(--jovaltus-fg);
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 0;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .message {
      padding: 8px 12px;
      border-radius: 6px;
      max-width: 85%;
      word-break: break-word;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .message.user {
      align-self: flex-end;
      background: var(--vscode-textBlockQuote-background);
    }

    .message.assistant {
      align-self: flex-start;
      background: var(--vscode-textCodeBlock-background);
    }

    .message.system {
      align-self: center;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      padding: 4px 8px;
      max-width: 100%;
      text-align: center;
    }

    .message.error {
      align-self: center;
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      font-size: 13px;
    }

    .input-area {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--jovaltus-input-border, var(--vscode-panel-border));
    }

    .input-area input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--jovaltus-input-border, var(--vscode-input-border));
      border-radius: 4px;
      background: var(--jovaltus-input-bg);
      color: var(--jovaltus-input-fg);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      outline: none;
    }

    .input-area input:focus {
      border-color: var(--vscode-focusBorder);
    }

    .input-area button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: var(--jovaltus-button-bg);
      color: var(--jovaltus-button-fg);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      cursor: pointer;
    }

    .input-area button:hover {
      background: var(--jovaltus-button-hover);
    }

    .welcome {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      padding: 24px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="messages" id="messages">
    <div class="welcome">Jovaltus — AI coding agent<br>Type a message to get started.</div>
  </div>
  <div class="input-area">
    <input id="user-input" type="text" placeholder="Send a message..." />
    <button id="send-btn">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    let firstMessage = true;
    let currentStreamBubble = null;

    function addMessage(text, role) {
      if (firstMessage) {
        messagesEl.innerHTML = '';
        firstMessage = false;
      }
      const msg = document.createElement('div');
      msg.className = 'message ' + role;
      msg.textContent = text;
      messagesEl.appendChild(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return msg;
    }

    function appendToStream(text) {
      if (currentStreamBubble) {
        currentStreamBubble.textContent += text;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    function flushStream() {
      currentStreamBubble = null;
    }

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;
      addMessage(text, 'user');
      inputEl.value = '';
      vscode.postMessage({ type: 'userMessage', text: text });
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') sendMessage();
    });

    window.addEventListener('message', function(event) {
      const msg = event.data;
      switch (msg.type) {
        case 'assistantMessage':
          addMessage(msg.text, 'assistant');
          flushStream();
          break;

        case 'phaseStart':
          addMessage('[Phase] ' + msg.phase + ': ' + msg.text, 'system');
          flushStream();
          break;

        case 'phaseEnd':
          addMessage(
            '[Phase] ' + msg.phase + ': ' + msg.status + ' — ' + msg.text,
            msg.status === 'failed' ? 'error' : 'system'
          );
          flushStream();
          break;

        case 'streamDelta':
          if (!currentStreamBubble) {
            currentStreamBubble = addMessage('', 'assistant');
          }
          appendToStream(msg.text);
          break;

        case 'toolCall':
          addMessage('[Tool] ' + msg.phase + ' → ' + msg.toolName, 'system');
          flushStream();
          break;

        case 'agentError':
          addMessage('[Error] ' + msg.phase + ': ' + msg.text, 'error');
          flushStream();
          break;

        case 'agentComplete':
          addMessage(msg.summary, 'assistant');
          flushStream();
          break;
      }
    });
  </script>
</body>
</html>`;
}

export class ChatPanelProvider implements vscode.WebviewViewProvider {
  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    webviewView.webview.html = getWebviewHtml();

    webviewView.webview.onDidReceiveMessage(
      (message: { readonly type: string; readonly text: string }) => {
        if (message.type === 'userMessage') {
          void this.handleUserMessage(message.text, webviewView);
        }
      },
    );
  }

  private async handleUserMessage(text: string, webviewView: vscode.WebviewView): Promise<void> {
    const configManager = new ConfigManager(new VSCodeConfigProvider());
    const config = configManager.getConfig();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.[0]) {
      void webviewView.webview.postMessage({
        type: 'agentError',
        phase: 'implementation',
        text: 'No workspace folder open. Please open a project first.',
      });
      return;
    }

    const repoPath = workspaceFolders[0].uri.fsPath;

    const orchestrator = new AgentModeOrchestrator({
      repoPath,
      config,
    });

    void webviewView.webview.postMessage({
      type: 'assistantMessage',
      text: `Starting agent mode task...`,
    });

    orchestrator.onEvent((event: AgentModeEvent) => {
      switch (event.type) {
        case 'phase_start':
          void webviewView.webview.postMessage({
            type: 'phaseStart',
            phase: event.phase,
            text: this.phaseLabel(event.phase),
          });
          break;

        case 'phase_end':
          void webviewView.webview.postMessage({
            type: 'phaseEnd',
            phase: event.phase,
            status: event.result.status,
            text: event.result.summary,
          });
          break;

        case 'stream_delta':
          void webviewView.webview.postMessage({
            type: 'streamDelta',
            phase: event.phase,
            text: event.text,
          });
          break;

        case 'tool_call':
          void webviewView.webview.postMessage({
            type: 'toolCall',
            phase: event.phase,
            toolName: event.toolName,
          });
          break;

        case 'tool_result':
          // Tool results are intermediate — don't spam the UI with each one
          break;

        case 'error':
          void webviewView.webview.postMessage({
            type: 'agentError',
            phase: event.phase,
            text: event.message,
          });
          break;
      }
    });

    try {
      const result = await orchestrator.run(text);

      void webviewView.webview.postMessage({
        type: 'agentComplete',
        summary: result.finalSummary,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      void webviewView.webview.postMessage({
        type: 'agentError',
        phase: 'implementation',
        text: `Fatal error: ${msg}`,
      });
    }
  }

  private phaseLabel(phase: string): string {
    const labels: Record<string, string> = {
      implementation: 'Implementing changes',
      planning: 'Distilling & planning',
      verification: 'Verifying & fixing',
      simplification: 'Simplifying code',
    };
    return labels[phase] ?? phase;
  }
}

/**
 * Bridges VS Code configuration API into core's ConfigProvider interface.
 */
class VSCodeConfigProvider implements ConfigProvider {
  public get<T>(key: string, defaultValue: T): T {
    const parts = key.split('.');
    const root = parts[0] ?? 'jovaltus';
    const section = parts.slice(1).join('.');
    const config = vscode.workspace.getConfiguration(root);
    const value = config.get<T>(section);
    return value !== undefined ? value : defaultValue;
  }
}
