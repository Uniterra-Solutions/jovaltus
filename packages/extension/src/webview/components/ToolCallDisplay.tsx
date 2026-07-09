import { useState } from 'react';

interface ToolCallPart {
  readonly toolName: string;
  readonly args: unknown;
  readonly result?: unknown;
  readonly isError?: boolean | undefined;
}

export function ToolCallDisplay({ part }: { readonly part: ToolCallPart }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`jovaltus-tool-call${part.isError ? ' jovaltus-tool-error' : ''}`}>
      <button
        className="jovaltus-tool-header"
        onClick={() => {
          setExpanded(!expanded);
        }}
        type="button"
        aria-expanded={expanded}
      >
        <span className="jovaltus-tool-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="jovaltus-tool-name">{part.toolName}</span>
        <span
          className={`jovaltus-tool-status jovaltus-tool-status-${part.result === undefined ? 'running' : part.isError ? 'error' : 'done'}`}
        >
          {part.result === undefined ? 'Running' : part.isError ? 'Error' : 'Done'}
        </span>
      </button>
      {expanded && (
        <div className="jovaltus-tool-details">
          {Object.keys(part.args ?? {}).length > 0 && (
            <div className="jovaltus-tool-section">
              <div className="jovaltus-tool-section-title">Arguments</div>
              <pre className="jovaltus-tool-pre">{JSON.stringify(part.args, null, 2)}</pre>
            </div>
          )}
          {part.result !== undefined && (
            <div className="jovaltus-tool-section">
              <div className="jovaltus-tool-section-title">Result</div>
              <pre className="jovaltus-tool-pre">
                {typeof part.result === 'string'
                  ? part.result
                  : JSON.stringify(part.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
