import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
} from '@assistant-ui/react';
import type { ThreadAssistantMessagePart } from '@assistant-ui/react';
import { createVSCodeEventStream, type VSCodeMessage } from './vscode-bridge.js';

export function createJovaltusAdapter(): ChatModelAdapter {
  return {
    async *run({
      messages,
      abortSignal,
    }: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
      const last = messages[messages.length - 1];
      const userText =
        last && last.role === 'user'
          ? last.content
              .filter(
                (p): p is { readonly type: 'text'; readonly text: string } => p.type === 'text',
              )
              .map((p) => p.text)
              .join('')
          : '';
      if (!userText) return;

      let accumulatedText = '';
      const toolCalls = new Map<string, ThreadAssistantMessagePart>();

      for await (const event of createVSCodeEventStream(userText, abortSignal)) {
        const result = toChunk(event, accumulatedText, toolCalls);
        if (!result) continue;

        const textPart = result.content.find((p) => p.type === 'text');
        if (textPart) accumulatedText = textPart.text;

        yield result;
      }
    },
  };
}

function toChunk(
  event: VSCodeMessage,
  accumulatedText: string,
  toolCalls: Map<string, ThreadAssistantMessagePart>,
): ChatModelRunResult | null {
  switch (event.type) {
    case 'streamDelta': {
      const text = accumulatedText + event.text;
      return { content: [{ type: 'text', text }], status: { type: 'running' } };
    }

    case 'toolCall': {
      const id = `${event.phase}-${event.toolName}`;
      const argsObj = (event.args as Record<string, unknown> | undefined) ?? {};
      toolCalls.set(id, {
        type: 'tool-call',
        toolCallId: id,
        toolName: event.toolName,
        args: argsObj,
        argsText: JSON.stringify(argsObj),
      });

      const tail = [...toolCalls.values()];
      return {
        content: accumulatedText ? [{ type: 'text', text: accumulatedText }, ...tail] : tail,
        status: { type: 'requires-action', reason: 'tool-calls' },
      };
    }

    case 'phaseStart':
      return {
        content: [{ type: 'text', text: `[Phase] ${event.phase}: ${event.text}` }],
        status: { type: 'running' },
      };

    case 'phaseEnd':
      return {
        content: [
          { type: 'text', text: `[Phase] ${event.phase}: ${event.status} - ${event.text}` },
        ],
        status: { type: 'running' },
      };

    case 'assistantMessage':
      return { content: [{ type: 'text', text: event.text }] };

    case 'agentError':
      return {
        content: [{ type: 'text', text: `[Error] ${event.phase}: ${event.text}` }],
        status: { type: 'incomplete', reason: 'error', error: event.text },
      };

    case 'agentComplete':
      return {
        content: [{ type: 'text', text: event.summary }],
        status: { type: 'complete', reason: 'stop' },
      };

    default:
      return null;
  }
}
