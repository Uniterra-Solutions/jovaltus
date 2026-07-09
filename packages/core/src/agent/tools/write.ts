import { Type } from '@sinclair/typebox';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const writeTool: AgentTool = {
  name: 'write',
  label: 'Write File',
  description: 'Write content to a file. Creates parent directories. Overwrites existing files.',
  parameters: Type.Object({
    filePath: Type.String({ description: 'Path to the file to write' }),
    content: Type.String({ description: 'Content to write' }),
  }),
  execute: async (_id, params) => {
    const { filePath, content } = params as { filePath: string; content: string };
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');
    return {
      content: [{ type: 'text', text: `Wrote ${String(content.length)} bytes to ${filePath}` }],
      details: { filePath, bytes: content.length },
    };
  },
};
