import { exec } from 'node:child_process';

import type { Tool, ToolResult } from './types.js';

// ---------------------------------------------------------------------------
// Bash tool – controlled command execution.
// ---------------------------------------------------------------------------

/** Maximum buffer for stdout/stderr (10 MiB). */
const MAX_BUFFER = 10 * 1024 * 1024;
/** Default timeout (30 s). */
const DEFAULT_TIMEOUT_MS = 30_000;

const BASH_TOOL: Tool = {
  definition: {
    id: 'bash',
    name: 'Bash',
    description:
      'Execute a shell command and return its combined stdout and stderr. ' +
      'The working directory is set to the workspace root. ' +
      'Timeout defaults to 30 seconds.',
  },
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute.',
      },
      timeoutMs: {
        type: 'number',
        description: 'Optional timeout in milliseconds (default 30000).',
      },
    },
    required: ['command'],
    additionalProperties: false,
  },
  handler: async (params, context): Promise<ToolResult<string>> => {
    const command = params.command;
    const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : DEFAULT_TIMEOUT_MS;

    if (typeof command !== 'string' || command.length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'command must be a non-empty string.' },
      };
    }

    return new Promise<ToolResult<string>>((resolve) => {
      const child = exec(
        command,
        {
          cwd: context.workspaceRoot,
          maxBuffer: MAX_BUFFER,
          timeout: timeoutMs,
        },
        (error, stdout, stderr) => {
          if (error) {
            // Include both the exit info and whatever output was produced.
            const output = stdout || stderr
              ? `\nstdout:\n${stdout}\nstderr:\n${stderr}`.trimEnd()
              : '';
            resolve({
              success: false,
              error: {
                code: 'EXECUTION_FAILED',
                message: `Command exited with code ${String(error.code ?? 'unknown')}${output ? ':\n' + output : ''}`,
                details: {
                  code: error.code,
                  signal: error.signal,
                  stdout,
                  stderr,
                },
              },
            });
            return;
          }

          const combined = [stdout, stderr].filter(Boolean).join('\n');
          resolve({ success: true, data: combined || '' });
        },
      );

      // Wire up the abort signal, if provided.
      if (context.signal) {
        const abort = () => {
          child.kill();
        };
        context.signal.addEventListener('abort', abort, { once: true });
        // Clean up the listener when the child exits so we don't leak.
        child.on('exit', () => {
          context.signal?.removeEventListener('abort', abort);
        });
      }
    });
  },
};

export function createBashTool(): Tool {
  return BASH_TOOL;
}
