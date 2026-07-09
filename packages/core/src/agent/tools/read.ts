import { Type } from '@sinclair/typebox';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { readFile } from 'node:fs/promises';

export const readTool: AgentTool = {
  name: 'read',
  label: 'Read File',
  description:
    'Read file contents with optional offset/limit pagination. Returns cat -n style output. Truncates at 2000 lines.',
  parameters: Type.Object({
    filePath: Type.String({ description: 'Path to the file to read' }),
    offset: Type.Optional(Type.Number({ description: 'Line number to start from (0-based)' })),
    limit: Type.Optional(Type.Number({ description: 'Max number of lines to read' })),
  }),
  execute: async (_id, params) => {
    const {
      filePath,
      offset = 0,
      limit = 2000,
    } = params as {
      filePath: string;
      offset?: number;
      limit?: number;
    };
    const lines = (await readFile(filePath, 'utf-8')).split('\n');
    const sliced = lines.slice(offset, offset + limit);
    const numbered = sliced
      .map((l, i) => `${String(offset + i + 1).padStart(6, ' ')}\t${l}`)
      .join('\n');
    const tail =
      lines.length > offset + limit
        ? `\n... (${String(lines.length - offset - limit)} lines remaining)`
        : '';
    return {
      content: [{ type: 'text', text: numbered + tail || '(empty)' }],
      details: { filePath, totalLines: lines.length, shown: sliced.length },
    };
  },
};
