import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

import type { Tool, ToolResult } from './types.js';

// ---------------------------------------------------------------------------
// Read tool definition
// ---------------------------------------------------------------------------

const READ_TOOL: Tool = {
  definition: {
    id: 'file_read',
    name: 'Read',
    description:
      'Read the full contents of a file from the local filesystem. ' +
      'The file must exist within the workspace. ' +
      'After a successful read, the session is permitted to write or edit the file.',
  },
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file, relative to the workspace root or absolute.',
      },
    },
    required: ['filePath'],
    additionalProperties: false,
  },
  handler: async (params, context): Promise<ToolResult<string>> => {
    const filePath = params.filePath;
    if (typeof filePath !== 'string' || filePath.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'filePath must be a non-empty string.',
        },
      };
    }

    const resolved = resolvePath(context.workspaceRoot, filePath);

    try {
      const content = await readFile(resolved, { encoding: 'utf-8' });
      context.readState.markRead(resolved);
      return { success: true, data: content };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'READ_FAILED',
          message: `Failed to read '${filePath}': ${String(err)}`,
          details: err,
        },
      };
    }
  },
};

export function createReadTool(): Tool {
  return READ_TOOL;
}
