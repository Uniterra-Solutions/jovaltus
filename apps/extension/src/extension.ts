import type { ExtensionContext } from 'vscode';

import { createAgentTask } from '@jovaltus/core';

export function activate(context: ExtensionContext): void {
  const bootstrapTask = createAgentTask('extension-bootstrap', 'Initialize Jovaltus extension.');

  context.subscriptions.push({
    dispose() {
      void bootstrapTask;
    },
  });
}

export function deactivate(): void {
  // VS Code calls this hook during extension shutdown.
}
