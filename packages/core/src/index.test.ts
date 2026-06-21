import { describe, expect, it } from 'vitest';

import { createAgentTask } from './index.js';

describe('createAgentTask', () => {
  it('normalizes valid task input', () => {
    expect(createAgentTask(' task-1 ', ' Build the agent loop. ')).toEqual({
      id: 'task-1',
      prompt: 'Build the agent loop.',
    });
  });

  it('rejects an empty prompt', () => {
    expect(() => createAgentTask('task-1', '   ')).toThrow('Agent task prompt is required.');
  });
});
