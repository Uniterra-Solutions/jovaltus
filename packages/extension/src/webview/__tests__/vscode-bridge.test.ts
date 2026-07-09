/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createVSCodeEventStream } from '../vscode-bridge.js';

function mockVSCodeApi(overrides: Partial<VSCodeApi> = {}): VSCodeApi {
  return { postMessage: vi.fn(), getState: vi.fn(), setState: vi.fn(), ...overrides };
}

describe('createVSCodeEventStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts userMessage on creation', () => {
    const postMessage = vi.fn();
    vi.stubGlobal('acquireVsCodeApi', () => mockVSCodeApi({ postMessage }));
    const controller = new AbortController();

    // Create the stream — triggers postMessage immediately
    const _stream = createVSCodeEventStream('hello', controller.signal);

    expect(postMessage).toHaveBeenCalledWith({ type: 'userMessage', text: 'hello' });
  });

  it('yields streamDelta events via async iteration', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('acquireVsCodeApi', () => mockVSCodeApi({ postMessage }));
    const controller = new AbortController();
    const stream = createVSCodeEventStream('hello', controller.signal);

    const iterator = stream[Symbol.asyncIterator]();

    // Dispatch a streamDelta event
    const nextPromise = iterator.next();
    window.postMessage({ type: 'streamDelta', phase: 'implementation', text: 'hello world' }, '*');

    const result = await nextPromise;
    expect(result.done).toBe(false);
    expect(result.value).toEqual({
      type: 'streamDelta',
      phase: 'implementation',
      text: 'hello world',
    });
  });

  it('ends stream on agentComplete', async () => {
    vi.stubGlobal('acquireVsCodeApi', () => mockVSCodeApi());
    const controller = new AbortController();
    const stream = createVSCodeEventStream('test', controller.signal);
    const iterator = stream[Symbol.asyncIterator]();

    // Dispatch complete
    const nextPromise = iterator.next();
    window.postMessage({ type: 'agentComplete', summary: 'Done!' }, '*');

    const result = await nextPromise;
    expect(result.done).toBe(false);
    expect(result.value).toEqual({ type: 'agentComplete', summary: 'Done!' });

    // Next iteration should be done
    const final = await iterator.next();
    expect(final.done).toBe(true);
  });

  it('ends stream on agentError', async () => {
    vi.stubGlobal('acquireVsCodeApi', () => mockVSCodeApi());
    const controller = new AbortController();
    const stream = createVSCodeEventStream('test', controller.signal);
    const iterator = stream[Symbol.asyncIterator]();

    const nextPromise = iterator.next();
    window.postMessage({ type: 'agentError', phase: 'implementation', text: 'fail' }, '*');

    const result = await nextPromise;
    expect(result.done).toBe(false);
    const value = result.value as { type: string };
    expect(value.type).toBe('agentError');
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
  });

  it('stops on abort signal', async () => {
    vi.stubGlobal('acquireVsCodeApi', () => mockVSCodeApi());
    const controller = new AbortController();
    const stream = createVSCodeEventStream('test', controller.signal);
    const iterator = stream[Symbol.asyncIterator]();

    controller.abort();
    const result = await iterator.next();
    expect(result.done).toBe(true);
  });

  it('processes multiple events in order', async () => {
    vi.stubGlobal('acquireVsCodeApi', () => mockVSCodeApi());
    const controller = new AbortController();
    const stream = createVSCodeEventStream('test', controller.signal);
    const iterator = stream[Symbol.asyncIterator]();

    // Queue all events first
    window.postMessage({ type: 'phaseStart', phase: 'implementation', text: 'Starting' }, '*');
    window.postMessage({ type: 'streamDelta', phase: 'implementation', text: 'ok' }, '*');
    window.postMessage({ type: 'agentComplete', summary: 'All done' }, '*');

    expect(await iterator.next()).toEqual({
      done: false,
      value: { type: 'phaseStart', phase: 'implementation', text: 'Starting' },
    });
    expect(await iterator.next()).toEqual({
      done: false,
      value: { type: 'streamDelta', phase: 'implementation', text: 'ok' },
    });
    expect(await iterator.next()).toEqual({
      done: false,
      value: { type: 'agentComplete', summary: 'All done' },
    });
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
  });
});
