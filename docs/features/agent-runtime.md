# Agent Runtime Features

## Tool Catalog Discovery

- **Given** tools are registered in the runtime
- **When** the runtime requests the tool catalog
- **Then** it receives every available tool with id, name, description, and parameter schema
- **And** it can retrieve individual tools by id or by name

## Workspace File Reading

- **Given** an agent session has a workspace root
- **When** the agent reads a valid file path in that workspace
- **Then** the file contents are returned to the agent
- **And** the session records that the file has been read

- **Given** the agent requests to read a missing or inaccessible file
- **When** the read operation is attempted
- **Then** a structured read failure is returned
- **And** the file is not marked as read in the session

- **Given** the agent specifies a file path that resolves outside the workspace root
- **When** the read operation is attempted
- **Then** a structured `INVALID_PARAMS` error is returned
- **And** the file is not marked as read in the session

## Workspace File Writing

- **Given** the agent specifies a path and file content
- **When** the path does not currently exist
- **Then** a new file is created at that path
- **And** any missing parent directories are created automatically

- **Given** the agent specifies a file path that resolves outside the workspace root
- **When** the write operation is attempted
- **Then** a structured `INVALID_PARAMS` error is returned
- **And** no file is created on disk

- **Given** the agent specifies an existing file path that has not been read in the current session
- **When** the write operation is attempted
- **Then** the operation is rejected with a read-before-write error
- **And** the original file content is preserved unchanged

- **Given** the agent specifies an existing file path that has been read in the current session
- **When** the write operation is attempted
- **Then** the file content is replaced with the new content

## Targeted File Editing

- **Given** the agent has read a file in the current session
- **When** the agent replaces specific text with new text
- **Then** the file is updated with the replacement applied

- **Given** the specified old text does not exist in the file
- **When** the edit operation is attempted
- **Then** a structured edit failure is returned
- **And** the file content is left unchanged

- **Given** the agent attempts to edit a file that has not been read in the current session
- **When** the edit operation is attempted
- **Then** it is rejected with a read-before-write error

- **Given** the agent specifies a file path that resolves outside the workspace root
- **When** the edit operation is attempted
- **Then** a structured `INVALID_PARAMS` error is returned
- **And** the file content is left unchanged

## Bash Command Execution

- **Given** the agent provides a non-empty command string
- **When** the command is executed from the workspace root
- **Then** the agent receives the command output

- **Given** the command fails, exits non-zero, or times out
- **When** execution completes
- **Then** the agent receives a structured execution failure with available stdout and stderr

- **Given** the command string is empty
- **When** execution is attempted
- **Then** a structured validation error is returned

## Runtime Context Composition

- **Given** the runtime starts a single-agent run
- **When** it requests the composed context
- **Then** it receives typed sections for memory, skills, tool descriptions, and MCP servers

- **Given** optional context sources (memory, skills, MCP servers) are not configured
- **When** context is composed
- **Then** memory, skills, and MCP sections return null
- **And** the tools section returns an empty list
- **And** the overall context request succeeds

- **Given** optional context sources (memory, skills, MCP servers) fail or reject
- **When** context is composed
- **Then** only the failing sections degrade to null
- **And** successful providers' data is preserved
- **And** the overall context request still succeeds

- **Given** a tool registry is provided to the context composer
- **When** tool descriptions are generated
- **Then** they include tool id, name, description, and parameter schema
- **And** no tool handlers are executed during description generation
