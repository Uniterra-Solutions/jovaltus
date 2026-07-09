/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import type { ChatModelRunResult, ChatModelRunOptions } from '@assistant-ui/react';

// Mock the vscode-bridge module so we control the event stream
vi.mock('../vscode-bridge.js', () => ({
  createVSCodeEventStream: vi.fn(),
}));

import { createJovaltusAdapter } from '../chat-adapter.js';
import { createVSCodeEventStream } from '../vscode-bridge.js';

function eventStream(events: object[]): AsyncIterable<object> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<object> {
      let i = 0;
      return {
        next(): Promise<IteratorResult<object>> {
          if (i >= events.length) return Promise.resolve({ done: true, value: undefined });
          const value = events[i++];
          return Promise.resolve({ done: false, value });
        },
      };
    },
  };
}

async function collectAdapterOutput(
  userText: string,
  events: object[],
): Promise<ChatModelRunResult[]> {
  const mocked = createVSCodeEventStream as ReturnType<typeof vi.fn>;
  mocked.mockReturnValue(eventStream(events));

  const adapter = createJovaltusAdapter();
  const controller = new AbortController();
  const generator = adapter.run({
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: userText }],
      },
    ],
    abortSignal: controller.signal,
  } as unknown as ChatModelRunOptions);

  const results: ChatModelRunResult[] = [];
  for await (const chunk of generator as AsyncIterable<ChatModelRunResult>) {
    results.push(chunk);
  }
  return results;
}

function first(result: ChatModelRunResult[]): ChatModelRunResult {
  const r = result[0];
  if (!r) throw new Error('expected at least one result');
  return r;
}

function second(result: ChatModelRunResult[]): ChatModelRunResult {
  const r = result[1];
  if (!r) throw new Error('expected at least two results');
  return r;
}

function last(result: ChatModelRunResult[]): ChatModelRunResult {
  const r = result[result.length - 1];
  if (!r) throw new Error('expected at least one result');
  return r;
}

describe('createJovaltusAdapter', () => {
  it('returns nothing for empty user message', async () => {
    const results = await collectAdapterOutput('', []);
    expect(results).toHaveLength(0);
  });

  it('yields text content for streamDelta events', async () => {
    const results = await collectAdapterOutput('hello', [
      { type: 'streamDelta', phase: 'implementation', text: 'hello ' },
      { type: 'streamDelta', phase: 'implementation', text: 'world' },
      { type: 'agentComplete', summary: 'All done' },
    ]);

    expect(results).toHaveLength(3);
    expect(first(results).content).toEqual([{ type: 'text', text: 'hello ' }]);
    expect(first(results).status).toEqual({ type: 'running' });
    expect(second(results).content).toEqual([{ type: 'text', text: 'hello world' }]);
    expect(last(results).status).toEqual({ type: 'complete', reason: 'stop' });
  });

  it('yields tool-call content with requires-action status', async () => {
    const results = await collectAdapterOutput('read file', [
      {
        type: 'toolCall',
        phase: 'implementation',
        toolName: 'read',
        args: { path: '/src/index.ts' },
      },
      { type: 'agentComplete', summary: 'Done' },
    ]);

    expect(results).toHaveLength(2);
    const r0 = first(results);
    expect(r0.status).toEqual({ type: 'requires-action', reason: 'tool-calls' });

    const toolPart = r0.content.find((p) => p.type === 'tool-call');
    if (!toolPart) throw new Error('expected tool-call part');
    expect(toolPart.toolName).toBe('read');
    expect(toolPart.args).toEqual({ path: '/src/index.ts' });
  });

  it('accumulates tool calls alongside text', async () => {
    const results = await collectAdapterOutput('do work', [
      { type: 'streamDelta', phase: 'implementation', text: 'I will' },
      { type: 'toolCall', phase: 'implementation', toolName: 'bash', args: { cmd: 'ls' } },
      { type: 'streamDelta', phase: 'implementation', text: 'check' },
      { type: 'agentComplete', summary: 'Done' },
    ]);

    const withTool = second(results);
    expect(withTool.content.filter((p) => p.type === 'text')).toHaveLength(1);
    expect(withTool.content.filter((p) => p.type === 'tool-call')).toHaveLength(1);
  });

  it('preserves multiple tool calls in content', async () => {
    const results = await collectAdapterOutput('multi tool', [
      { type: 'toolCall', phase: 'implementation', toolName: 'read', args: {} },
      { type: 'toolCall', phase: 'implementation', toolName: 'bash', args: {} },
      { type: 'agentComplete', summary: 'Done' },
    ]);

    const r1 = second(results);
    const toolCalls = r1.content.filter((p) => p.type === 'tool-call');
    expect(toolCalls).toHaveLength(2);
    const t0 = toolCalls[0];
    const t1 = toolCalls[1];
    if (!t0 || !t1) throw new Error('expected tool-call parts');
    expect(t0.toolName).toBe('read');
    expect(t1.toolName).toBe('bash');
  });

  it('handles agentError with incomplete status', async () => {
    const results = await collectAdapterOutput('bad idea', [
      { type: 'agentError', phase: 'implementation', text: 'Something went wrong' },
    ]);

    expect(results).toHaveLength(1);
    expect(first(results).status).toEqual({
      type: 'incomplete',
      reason: 'error',
      error: 'Something went wrong',
    });
  });

  it('handles phaseStart and phaseEnd as text annotations', async () => {
    const results = await collectAdapterOutput('task', [
      { type: 'phaseStart', phase: 'implementation', text: 'Implementing changes' },
      { type: 'phaseEnd', phase: 'implementation', status: 'completed', text: 'Phase done' },
      { type: 'agentComplete', summary: 'Complete' },
    ]);

    const t0 = first(results).content[0];
    const t1 = second(results).content[0];
    if (!t0 || !t1) throw new Error('expected text parts');
    expect(t0.text).toContain('[Phase]');
    expect(t0.text).toContain('implementation');
    expect(t1.text).toContain('completed');
  });

  it('handles toolCall with no args', async () => {
    const results = await collectAdapterOutput('run', [
      { type: 'toolCall', phase: 'verification', toolName: 'bash' },
      { type: 'agentComplete', summary: 'ok' },
    ]);

    const toolPart = first(results).content.find((p) => p.type === 'tool-call');
    if (!toolPart) throw new Error('expected tool-call part');
    expect(toolPart.args).toEqual({});
  });
});
