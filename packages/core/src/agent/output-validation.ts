import type { Agent } from '@earendil-works/pi-agent-core';
import type { TSchema, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export type StructuredOutputResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly errors: readonly string[]; readonly rawText: string };

/** Find the first balanced `{...}` JSON object, stripping markdown fences. */
export function extractJsonFromText(text: string): string | null {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const src = fence?.[1]?.trim() ?? text;
  const start = src.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i] as string;
    if (inString) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const texts: string[] = [];
  for (const block of content) {
    const b = block as { type?: string; text?: string };
    if (b.type === 'text' && b.text) texts.push(b.text);
  }
  return texts.join('\n');
}

function lastAssistantText(messages: readonly unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; content?: unknown };
    if (msg.role === 'assistant') {
      const text = extractText(msg.content);
      if (text) return text;
    }
  }
  return '';
}

export function validateOutput<T extends TSchema>(
  text: string,
  schema: T,
): StructuredOutputResult<Static<T>> {
  const json = extractJsonFromText(text);
  if (json === null)
    return { ok: false, errors: ['No JSON object found in response'], rawText: text };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e: unknown) {
    return {
      ok: false,
      errors: [`Invalid JSON: ${e instanceof SyntaxError ? e.message : String(e)}`],
      rawText: text,
    };
  }

  const errors: string[] = [];
  for (const err of Value.Errors(schema, parsed)) errors.push(`${err.path}: ${err.message}`);
  return errors.length > 0
    ? { ok: false, errors, rawText: text }
    : { ok: true, data: parsed as Static<T> };
}

export function generateJsonExample(schema: TSchema): string {
  return JSON.stringify(Value.Create(schema), null, 2);
}

export function buildValidationRetryPrompt(errors: readonly string[], schema: TSchema): string {
  return `Fix these JSON validation errors:\n${errors.map((e) => `- ${e}`).join('\n')}

Expected format:
\`\`\`json
${generateJsonExample(schema)}
\`\`\`

Output ONLY the corrected JSON object.`;
}

export async function promptWithValidation<T extends TSchema>(
  agent: Agent,
  prompt: string,
  schema: T,
  maxRetries = 3,
): Promise<StructuredOutputResult<Static<T>>> {
  let lastErrors: readonly string[] = [];
  let lastRawText = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await agent.prompt(attempt === 0 ? prompt : buildValidationRetryPrompt(lastErrors, schema));
    await agent.waitForIdle();

    if (agent.state.errorMessage)
      return { ok: false, errors: [`Agent error: ${agent.state.errorMessage}`], rawText: '' };

    const text = lastAssistantText(agent.state.messages);
    lastRawText = text;
    const result = validateOutput(text, schema);
    if (result.ok) return result;
    lastErrors = result.errors;
  }

  return {
    ok: false,
    errors: [`Validation failed after ${String(maxRetries + 1)} attempts.`, ...lastErrors],
    rawText: lastRawText,
  };
}
