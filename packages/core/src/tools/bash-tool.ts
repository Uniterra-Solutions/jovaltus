import { exec } from 'node:child_process';

import type { Tool, ToolResult } from './types.js';

// ---------------------------------------------------------------------------
// Bash tool – controlled command execution.
// ---------------------------------------------------------------------------

/** Maximum buffer for stdout/stderr (10 MiB). */
const MAX_BUFFER = 10 * 1024 * 1024;
/** Default timeout (30 s). */
const DEFAULT_TIMEOUT_MS = 30_000;
/**
 * Maximum valid timeout (2^31 - 1). Node's setTimeout uses a 32-bit signed
 * integer internally; values beyond this are clamped or misbehave.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

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

    if (typeof command !== 'string' || command.length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'command must be a non-empty string.' },
      };
    }

    // Determine effective timeout, validating if caller supplied a value.
    let timeoutMs = DEFAULT_TIMEOUT_MS;
    if (params.timeoutMs !== undefined) {
      if (
        typeof params.timeoutMs !== 'number'
        || !Number.isInteger(params.timeoutMs)
        || params.timeoutMs < 1
        || params.timeoutMs > MAX_TIMEOUT_MS
      ) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'timeoutMs must be a positive integer between 1 and 2147483647 milliseconds.',
          },
        };
      }
      timeoutMs = params.timeoutMs;
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
