import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  groupPartByType,
  useAuiState,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { ToolCallDisplay } from './ToolCallDisplay.js';
import { ModelSelector } from './ModelSelector.js';
import type { ModelOption } from '../init-models.js';

interface ChatViewProps {
  readonly currentModelId: string;
  readonly availableModels: readonly ModelOption[];
  readonly onModelChange: (modelId: string) => void;
}

export function ChatView({
  currentModelId,
  availableModels,
  onModelChange,
}: ChatViewProps): React.JSX.Element {
  const isEmpty = useAuiState((s) => s.thread.messages.length === 0);

  return (
    <ThreadPrimitive.Root className="jovaltus-chat">
      <ModelSelector
        currentModelId={currentModelId}
        availableModels={availableModels}
        onModelChange={onModelChange}
      />
      <ThreadPrimitive.Viewport className="jovaltus-viewport">
        {isEmpty ? (
          <div className="jovaltus-welcome">
            <p>Jovaltus — AI coding agent</p>
            <p>Type a message to get started.</p>
          </div>
        ) : (
          <ThreadPrimitive.Messages className="jovaltus-messages">
            {({ message }) => {
              if (message.role === 'user') {
                return (
                  <MessagePrimitive.Root className="jovaltus-message-user">
                    <div className="jovaltus-message-content">
                      {message.content.map((part, i) =>
                        part.type === 'text' ? <span key={i}>{part.text}</span> : null,
                      )}
                    </div>
                  </MessagePrimitive.Root>
                );
              }
              return (
                <MessagePrimitive.Root className="jovaltus-message-assistant">
                  <div className="jovaltus-message-content">
                    <MessagePrimitive.GroupedParts
                      groupBy={groupPartByType({ 'tool-call': ['group-tool'] })}
                    >
                      {({ part }) => {
                        switch (part.type) {
                          case 'text':
                            return <MarkdownTextPrimitive smooth />;
                          case 'tool-call':
                            return <ToolCallDisplay part={part} />;
                          case 'image':
                          case 'file':
                          case 'data':
                          case 'audio':
                          case 'reasoning':
                          case 'source':
                          case 'generative-ui':
                          case 'indicator':
                            return null;
                        }
                      }}
                    </MessagePrimitive.GroupedParts>
                  </div>
                </MessagePrimitive.Root>
              );
            }}
          </ThreadPrimitive.Messages>
        )}
        <ThreadPrimitive.ViewportFooter>
          <div className="jovaltus-composer-area">
            <ComposerPrimitive.Root className="jovaltus-composer">
              <ComposerPrimitive.Input
                className="jovaltus-composer-input"
                placeholder="Send a message..."
                autoFocus
              />
              <div className="jovaltus-composer-actions">
                <ComposerPrimitive.Cancel asChild>
                  <button className="jovaltus-btn jovaltus-btn-cancel">Cancel</button>
                </ComposerPrimitive.Cancel>
                <ComposerPrimitive.Send asChild>
                  <button className="jovaltus-btn jovaltus-btn-send">Send</button>
                </ComposerPrimitive.Send>
              </div>
            </ComposerPrimitive.Root>
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
