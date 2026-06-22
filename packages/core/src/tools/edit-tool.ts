import { readFile, writeFile } from 'node:fs/promises';

import type { Tool, ToolResult } from './types.js';
import { resolveInWorkspace } from './workspace.js';

// ---------------------------------------------------------------------------
// Edit tool – targeted find-and-replace on a single file.
// ---------------------------------------------------------------------------

const EDIT_TOOL: Tool = {
  definition: {
    id: 'file_edit',
    name: 'Edit',
    description:
      'Apply a textual replacement in an existing file. ' +
      'The file must have been read first via the Read tool. ' +
      'The oldString is matched exactly (whitespace-sensitive) and replaced ' +
      'with newString. Only the first occurrence is replaced.',
  },
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file, relative to the workspace root or absolute.',
      },
      oldString: {
        type: 'string',
        description: 'Exact text to find (whitespace-sensitive).',
      },
      newString: {
        type: 'string',
        description: 'Text to replace the oldString with.',
      },
    },
    required: ['filePath', 'oldString', 'newString'],
    additionalProperties: false,
  },
  handler: async (params, context): Promise<ToolResult> => {
    const filePath = params.filePath;
    const oldString = params.oldString;
    const newString = params.newString;

    if (typeof filePath !== 'string' || filePath.length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'filePath must be a non-empty string.' },
      };
    }
    if (typeof oldString !== 'string' || oldString.length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'oldString must be a non-empty string.' },
      };
    }
    if (typeof newString !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'newString must be a string.' },
      };
    }

    const wsResult = await resolveInWorkspace(context.workspaceRoot, filePath);
    if (!wsResult.ok) {
      return { success: false, error: wsResult.error };
    }
    const resolved = wsResult.path;

    // Safety guard: must have been read first.
    if (!context.readState.hasRead(resolved)) {
      return {
        success: false,
        error: {
          code: 'FILE_NOT_READ',
          message:
            `Cannot edit '${filePath}' – the file has not been read. ` +
            `Use the Read tool first.`,
        },
      };
    }

    try {
      const current = await readFile(resolved, { encoding: 'utf-8' });

      if (!current.includes(oldString)) {
        return {
          success: false,
          error: {
            code: 'EDIT_FAILED',
            message: `oldString was not found in '${filePath}'.`,
          },
        };
      }

      const updated = current.replace(oldString, newString);
      await writeFile(resolved, updated, { encoding: 'utf-8' });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'EDIT_FAILED',
          message: `Failed to edit '${filePath}': ${String(err)}`,
          details: err,
        },
      };
    }
  },
};

export function createEditTool(): Tool {
  return EDIT_TOOL;
}
