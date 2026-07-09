import * as vscode from 'vscode';

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
    }

    .message.user {
      align-self: flex-end;
      background: var(--vscode-textBlockQuote-background);
    }

    .message.assistant {
      align-self: flex-start;
      background: var(--vscode-textCodeBlock-background);
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
      if (msg.type === 'assistantMessage') {
        addMessage(msg.text, 'assistant');
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
        if (message.type === 'userMessage')
          void webviewView.webview.postMessage({
            type: 'assistantMessage',
            text: `Echo: ${message.text}`,
          });
      },
    );
  }
}
