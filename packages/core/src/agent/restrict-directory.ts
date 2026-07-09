import type { BeforeToolCallContext, BeforeToolCallResult } from '@earendil-works/pi-agent-core';
import { isAbsolute, normalize, resolve } from 'node:path';

const PATH_KEYS = new Set(['filePath', 'path', 'targetPath', 'sourcePath']);

function extractPaths(args: unknown): string[] {
  if (typeof args !== 'object' || args === null) return [];
  const r = args as Record<string, unknown>;
  return [...PATH_KEYS].filter((k) => typeof r[k] === 'string').map((k) => r[k] as string);
}

function isWithin(candidate: string, allowedDir: string): boolean {
  const abs = isAbsolute(candidate) ? candidate : resolve(allowedDir, candidate);
  const n = normalize(abs);
  const a = normalize(allowedDir);
  return n === a || n.startsWith(a + '/');
}

export function restrictToDirectory(
  allowedDir: string,
): (ctx: BeforeToolCallContext) => Promise<BeforeToolCallResult | undefined> {
  const dir = normalize(resolve(allowedDir));

  // eslint-disable-next-line @typescript-eslint/require-await -- returning Promise to match pi-agent-core hook signature
  return async (ctx) => {
    for (const p of extractPaths(ctx.args)) {
      if (!isWithin(p, dir)) {
        return {
          block: true,
          reason: `Access denied: "${p}" is outside the allowed directory`,
        };
      }
    }
    return undefined;
  };
}
