# Reference: Node Runtime APIs for Agent Runtime Foundation

## Purpose

This implementation uses existing Node.js runtime APIs and Vitest. No new external runtime dependency is required.

## External Methods

### `node:fs/promises.readFile(path, options)`
- **Purpose**: Read a workspace file as UTF-8 text for the `file_read` tool.
- **Required parameters**:
  - `path`: resolved file path.
  - `options.encoding`: `utf-8`.
- **Source URL**: https://nodejs.org/api/fs.html

### `node:fs/promises.writeFile(path, data, options)`
- **Purpose**: Write UTF-8 text for full-file writes and targeted edits.
- **Required parameters**:
  - `path`: resolved file path.
  - `data`: text content.
  - `options.encoding`: `utf-8`.
- **Source URL**: https://nodejs.org/api/fs.html

### `node:fs/promises.mkdir(path, { recursive: true })`
- **Purpose**: Create parent directories for new file writes.
- **Required parameters**:
  - `path`: parent directory path.
  - `recursive`: `true`.
- **Source URL**: https://nodejs.org/api/fs.html

### `node:child_process.exec(command, options, callback)`
- **Purpose**: Execute local bash commands through the `bash` tool.
- **Required parameters**:
  - `command`: non-empty command string.
  - `options.cwd`: workspace root.
  - `options.timeout`: bounded timeout.
  - `options.maxBuffer`: bounded output buffer.
  - `callback`: maps error/stdout/stderr to `ToolResult`.
- **Source URL**: https://nodejs.org/api/child_process.html

## Notes for Implementation

- Preserve structured errors; do not throw file or process failures past the tool registry.
- Do not add external packages for file or process behavior.
- Keep tests deterministic by using temp directories and simple local commands.
