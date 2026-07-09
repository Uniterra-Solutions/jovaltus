import { Type } from '@sinclair/typebox';
import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';
import { readFile, writeFile } from 'node:fs/promises';

export const editTool: AgentTool = {
  name: 'edit',
  label: 'Edit File',
  description:
    'Edit a file by exact string replacement. Requires oldString appears exactly once (or use replaceAll).',
  parameters: Type.Object({
    filePath: Type.String({ description: 'Path to the file to edit' }),
    oldString: Type.String({ description: 'Exact text to replace' }),
    newString: Type.String({ description: 'Replacement text' }),
    replaceAll: Type.Optional(Type.Boolean({ description: 'Replace all occurrences' })),
  }),
  execute: async (_id, params) => {
    const { filePath, oldString, newString, replaceAll } = params as {
      filePath: string;
      oldString: string;
      newString: string;
      replaceAll?: boolean;
    };
    const original = await readFile(filePath, 'utf-8');

    if (!replaceAll) {
      const idx = original.indexOf(oldString);
      if (idx === -1) return fail(filePath, 'not_found', 'oldString not found');
      if (original.indexOf(oldString, idx + 1) !== -1)
        return fail(filePath, 'ambiguous', 'oldString appears multiple times — use replaceAll');
      const edited = original.slice(0, idx) + newString + original.slice(idx + oldString.length);
      await writeFile(filePath, edited, 'utf-8');
      return ok(filePath, 1);
    }

    const count = original.split(oldString).length - 1;
    if (!count) return fail(filePath, 'not_found', 'oldString not found');
    await writeFile(filePath, original.replaceAll(oldString, newString), 'utf-8');
    return ok(filePath, count);
  },
};

function fail(
  filePath: string,
  error: string,
  text: string,
): AgentToolResult<{ filePath: string; error: string }> {
  return {
    content: [{ type: 'text' as const, text: `Error: ${text} in ${filePath}` }],
    details: { filePath, error },
  };
}
function ok(
  filePath: string,
  occurrences: number,
): AgentToolResult<{ filePath: string; occurrences: number }> {
  return {
    content: [
      {
        type: 'text' as const,
        text: `Replaced ${String(occurrences)} occurrence(s) in ${filePath}`,
      },
    ],
    details: { filePath, occurrences },
  };
}
