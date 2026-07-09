import { Type } from '@sinclair/typebox';
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const MAX_BYTES = 50_000;

export const bashTool: AgentTool = {
  name: 'bash',
  label: 'Bash',
  description:
    'Execute a shell command. Returns stdout/stderr. Default 30s timeout. Output truncated at 50KB.',
  parameters: Type.Object({
    command: Type.String({ description: 'Bash command to execute' }),
    timeout: Type.Optional(Type.Number({ description: 'Timeout in seconds (default 30)' })),
  }),
  execute: async (_id, params, signal) => {
    const { command, timeout = 30 } = params as { command: string; timeout?: number };
    const timeoutMs = Math.min(timeout * 1000, 300_000);

    try {
      const { stdout, stderr } = await exec('/bin/bash', ['-c', command], {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        signal,
      });
      return result(stdout, stderr, 0);
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        killed?: boolean;
      };
      return result(e.stdout ?? '', e.stderr ?? '', e.code ?? 1, e.killed);
    }
  },
};

function result(
  stdout: string,
  stderr: string,
  exitCode: number | string,
  killed = false,
): AgentToolResult<{ exitCode: number | string; killed: boolean }> {
  let text = [stdout, stderr].filter(Boolean).join('\n') || '(no output)';
  if (killed) text += '\n(timed out)';
  if (text.length > MAX_BYTES) text = `... (truncated)\n${text.slice(-MAX_BYTES)}`;
  return {
    content: [{ type: 'text' as const, text }],
    details: { exitCode, killed },
  };
}
