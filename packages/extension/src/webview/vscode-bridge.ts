type VSCodeMessage =
  | { readonly type: 'assistantMessage'; readonly text: string }
  | { readonly type: 'phaseStart'; readonly phase: string; readonly text: string }
  | {
      readonly type: 'phaseEnd';
      readonly phase: string;
      readonly status: string;
      readonly text: string;
    }
  | { readonly type: 'streamDelta'; readonly phase: string; readonly text: string }
  | {
      readonly type: 'toolCall';
      readonly phase: string;
      readonly toolName: string;
      readonly args: unknown;
    }
  | { readonly type: 'agentError'; readonly phase: string; readonly text: string }
  | { readonly type: 'agentComplete'; readonly summary: string };

export { type VSCodeMessage };

export function createVSCodeEventStream(
  userText: string,
  abortSignal: AbortSignal,
): AsyncIterable<VSCodeMessage> {
  const vscode = acquireVsCodeApi();
  vscode.postMessage({ type: 'userMessage', text: userText });

  const events: VSCodeMessage[] = [];
  let resolver: (() => void) | null = null;
  let done = false;

  function onMessage(event: MessageEvent<VSCodeMessage>): void {
    events.push(event.data);
    if (event.data.type === 'agentComplete' || event.data.type === 'agentError') done = true;
    resolver?.();
  }

  window.addEventListener('message', onMessage);
  abortSignal.addEventListener(
    'abort',
    () => {
      done = true;
      resolver?.();
    },
    { once: true },
  );

  return {
    [Symbol.asyncIterator](): AsyncIterator<VSCodeMessage> {
      return {
        async next(): Promise<IteratorResult<VSCodeMessage>> {
          while (events.length === 0 && !done) {
            await new Promise<void>((r) => {
              resolver = r;
            });
          }
          const event = events.shift();
          if (!event) {
            window.removeEventListener('message', onMessage);
            return { done: true, value: undefined };
          }
          return { done: false, value: event };
        },
      };
    },
  };
}
