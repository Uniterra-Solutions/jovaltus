import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function execGit(
  args: readonly string[],
  cwd: string,
  timeoutMs?: number,
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return exec('git', args, {
    cwd,
    timeout: timeoutMs ?? 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

export function gitErr(err: unknown): string {
  const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
  return (e.stderr || e.stdout || e.message).trim();
}
