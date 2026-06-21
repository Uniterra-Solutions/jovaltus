export interface AgentTask {
  readonly id: string;
  readonly prompt: string;
}

export function createAgentTask(id: string, prompt: string): AgentTask {
  const trimmedId = id.trim();
  const trimmedPrompt = prompt.trim();

  if (trimmedId.length === 0) {
    throw new Error('Agent task id is required.');
  }

  if (trimmedPrompt.length === 0) {
    throw new Error('Agent task prompt is required.');
  }

  return {
    id: trimmedId,
    prompt: trimmedPrompt,
  };
}
