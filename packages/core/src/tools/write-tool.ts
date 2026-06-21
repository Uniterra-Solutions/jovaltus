import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { constants } from 'node:fs';

import type { Tool, ToolResult } from './types.js';

// ---------------------------------------------------------------------------
// Write tool – full-file overwrite (or create).
// ---------------------------------------------------------------------------

async function fileExists(resolved: string): Promise<boolean> {
  try {
    await access(resolved, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const WRITE_TOOL: Tool = {
  definition: {
    id: 'file_write',
    name: 'Write',
    description:
      'Write content to a file, creating it if it does not exist. ' +
      'If the file already exists it must have been read first via the Read tool. ' +
      'The parent directory is created automatically when missing.',
  },
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file, relative to the workspace root or absolute.',
      },
      content: {
        type: 'string',
        description: 'Text content to write to the file.',
      },
    },
    required: ['filePath', 'content'],
    additionalProperties: false,
  },
  handler: async (params, context): Promise<ToolResult> => {
    const filePath = params.filePath;
    const content = params.content;

    if (typeof filePath !== 'string' || filePath.length === 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'filePath must be a non-empty string.',
        },
      };
    }

    if (typeof content !== 'string') {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'content must be a string.',
        },
      };
    }

    const resolved = resolvePath(context.workspaceRoot, filePath);

    // Safety guard: existing files must have been read first.
    if (await fileExists(resolved)) {
      if (!context.readState.hasRead(resolved)) {
        return {
          success: false,
          error: {
            code: 'FILE_NOT_READ',
            message:
              `Cannot write to '${filePath}' – the file exists but has not been read. ` +
              `Use the Read tool first.`,
          },
        };
      }
    }

    try {
      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, { encoding: 'utf-8' });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'WRITE_FAILED',
          message: `Failed to write '${filePath}': ${String(err)}`,
          details: err,
        },
      };
    }
  },
};

export function createWriteTool(): Tool {
  return WRITE_TOOL;
}
