# Spec: Agent Runtime Foundation

- **Date**: 2026-06-21
- **Feature**: Agent Runtime Foundation

## Goal
Provide a centralized, runtime-consumable foundation for agent tools and context so agent runs receive consistent tool access, safety behavior, structured errors, and non-executing context payloads.

## Scope

### In Scope
- A tool catalog that can expose all registered tools and retrieve selected tools for a single agent run.
- Initial local tools for reading workspace files, writing or editing workspace files, and executing bash commands from the workspace.
- Session-level read tracking so existing files cannot be written or edited until the agent session has read them.
- Structured tool success and failure results that can be consumed by an agent loop.
- A context composition surface that provides memory, skills, tool descriptions, and MCP context for a single-agent run.
- Graceful behavior when optional context sources, such as memory stores, skill registries, or MCP servers, are empty or unavailable.

### Out of Scope
- Agent loop orchestration, model invocation, tool-call planning, retries, or conversation management.
- External memory persistence, external skill marketplace integration, or live MCP server execution.
- Permission policy UI, user approval flows, sandbox enforcement, or remote command execution.
- Multi-agent coordination and cross-session read-state sharing.
- Versioning, release packaging, or GitHub issue automation.

## Functional Behaviors (BDD)

### Requirement 1: Tool Discovery for Agent Runs
**GIVEN** tools are available to the runtime
**WHEN** the runtime requests the tool catalog for an agent run
**THEN** it can list every available tool with stable identifiers, names, descriptions, and parameter descriptions
**AND** it can retrieve selected tools by identifier or name without needing to know the tool implementation details.

**Uncertainty Level**: Known

### Requirement 2: Workspace File Reading
**GIVEN** an agent run has a workspace root and a readable file in that workspace
**WHEN** the file read tool is invoked with a valid file path
**THEN** the file contents are returned to the caller
**AND** the agent session records that the resolved file has been read for later write-safety checks.

**Uncertainty Level**: Known

### Requirement 3: Read-Before-Write Safety
**GIVEN** an agent run attempts to write or edit an existing workspace file
**AND** the current agent session has not previously read that file
**WHEN** the write or edit operation is requested
**THEN** the operation is rejected with a structured error that identifies the file-read precondition
**AND** the existing file content is left unchanged.

**Uncertainty Level**: Known

### Requirement 4: Controlled Bash Execution
**GIVEN** an agent run has access to the bash tool
**WHEN** a valid command is executed through the tool interface
**THEN** the command runs with the workspace as its working directory
**AND** the caller receives either command output or a structured execution failure.

**Uncertainty Level**: Known

### Requirement 5: Composed Runtime Context
**GIVEN** the runtime starts a single-agent run
**WHEN** it requests the composed context payload
**THEN** it receives typed context sections for memory, skills, tool descriptions, and MCPs
**AND** tool context describes available tools without executing them
**AND** missing or empty sources return null or empty sections rather than failing the whole context request.

**Uncertainty Level**: Known

## Error and Edge Cases

- Unknown tool identifiers return a structured not-found error rather than throwing into the agent loop.
- Tool handlers that throw unexpectedly are converted into structured unknown-error results.
- Invalid tool parameters, including empty file paths, non-string write content, empty edit search text, or empty commands, return structured validation errors.
- File reads for missing, inaccessible, or non-readable paths return structured read failures without marking the file as read.
- Existing file writes and edits are rejected when the agent session has not read the resolved target path first.
- Editing a file whose requested old text is not present returns a structured edit failure and leaves the file unchanged.
- Bash command failures, non-zero exits, timeouts, or termination signals return structured execution failures with available stdout and stderr details.
- Empty memory, skills, and MCP sources degrade to null or empty context sections so the runtime can still start an agent run.
- Tool-description context must not execute handlers or mutate read state while describing available tools.
- Authorization boundary: only the runtime may choose which registered tools are passed into an agent run; this spec does not grant agents unrestricted direct access to tool implementations.
- Data boundary: path inputs, command inputs, and context payloads must have typed validation outcomes suitable for runtime consumption.
- External dependency anomaly: unavailable future memory stores, skill registries, or MCP servers must not prevent tool descriptions from being composed.
- Abuse boundary: repeated write/edit attempts against unread existing files must consistently fail until a successful read occurs in the same session.
- Failure handling: all tool and context failures exposed to the agent loop must be machine-consumable, not only free-form thrown exceptions.

## Clarification Questions

None. The requested issue scope is known and maps directly to existing core-package boundaries.

## References

- **Key code file paths** (affected by this spec):
  - `packages/core/src/tools/types.ts`
  - `packages/core/src/tools/registry.ts`
  - `packages/core/src/tools/read-state.ts`
  - `packages/core/src/tools/read-tool.ts`
  - `packages/core/src/tools/write-tool.ts`
  - `packages/core/src/tools/edit-tool.ts`
  - `packages/core/src/tools/bash-tool.ts`
  - `packages/core/src/tools/index.ts`
  - `packages/core/src/context/types.ts`
  - `packages/core/src/context/composer.ts`
  - `packages/core/src/context/index.ts`
  - `packages/core/src/index.ts`
  - `packages/core/src/tools/registry.test.ts`
- Related project context files:
  - `README.md`
  - `package.json`
  - `pnpm-workspace.yaml`
- Repository exploration notes:
  - `apltk codegraph --help` was available and documented `context`, `files`, `query`, `callers`, `callees`, and `impact` exploration commands.
  - `apltk codegraph status --json` could not run because this checkout is not a Git repository and CodeGraph is not initialized.
  - `git status --short --branch` could not run because this checkout has no `.git` metadata, so the dedicated-branch step could not be performed in this workspace.
