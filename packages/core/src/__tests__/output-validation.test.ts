import { describe, it, expect } from 'vitest';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  extractJsonFromText,
  validateOutput,
  generateJsonExample,
  buildValidationRetryPrompt,
} from '../agent/output-validation.js';

const TestSchema = Type.Object({
  name: Type.String({ description: 'A string field' }),
  age: Type.Number(),
});

describe('extractJsonFromText', () => {
  it('extracts plain JSON object', () => {
    const result = extractJsonFromText('{"name":"Alice","age":30}');
    expect(result).toBe('{"name":"Alice","age":30}');
  });

  it('extracts JSON from markdown code fence with json tag', () => {
    const result = extractJsonFromText('```json\n{"name":"Alice"}\n```');
    expect(result).toBe('{"name":"Alice"}');
  });

  it('extracts JSON from markdown code fence without language', () => {
    const result = extractJsonFromText('```\n{"name":"Alice"}\n```');
    expect(result).toBe('{"name":"Alice"}');
  });

  it('extracts JSON when text precedes the JSON block', () => {
    const result = extractJsonFromText(
      'Here is the plan:\n{"taskSummary":"Add validation","implementationPlan":"..."}',
    );
    expect(result).toBe('{"taskSummary":"Add validation","implementationPlan":"..."}');
  });

  it('extracts JSON when text follows the JSON block', () => {
    const result = extractJsonFromText('{"name":"Alice"}\nAdditional notes here.');
    expect(result).toBe('{"name":"Alice"}');
  });

  it('handles nested objects', () => {
    const result = extractJsonFromText('{"a":{"b":{"c":"deep"}},"d":[1,2,3]}');
    expect(result).toBe('{"a":{"b":{"c":"deep"}},"d":[1,2,3]}');
  });

  it('returns null when no JSON object is found', () => {
    const result = extractJsonFromText('Just some plain text, no JSON here.');
    expect(result).toBeNull();
  });
});

describe('validateOutput', () => {
  it('returns ok on valid JSON matching schema', () => {
    const result = validateOutput('{"name":"Alice","age":30}', TestSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('returns error for missing required field', () => {
    const result = validateOutput('{"name":"Alice"}', TestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('age'))).toBe(true);
    }
  });

  it('returns error for wrong type', () => {
    const result = validateOutput('{"name":123,"age":"not-a-number"}', TestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
      expect(result.errors.some((e) => e.includes('age'))).toBe(true);
    }
  });

  it('returns error when no JSON found', () => {
    const result = validateOutput('This is not JSON', TestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('No JSON object found');
    }
  });

  it('returns error for invalid JSON', () => {
    const result = validateOutput('{"name":"Alice", invalid}', TestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('Invalid JSON');
    }
  });

  it('returns error for empty object', () => {
    const result = validateOutput('{}', TestSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe('generateJsonExample', () => {
  it('generates example that validates against the schema', () => {
    const example = generateJsonExample(TestSchema);
    const parsed = JSON.parse(example) as unknown;
    expect(Value.Check(TestSchema, parsed)).toBe(true);
  });

  it('generated example has expected keys', () => {
    const example = generateJsonExample(TestSchema);
    const parsed = JSON.parse(example) as Record<string, unknown>;
    expect(parsed).toHaveProperty('name');
    expect(parsed).toHaveProperty('age');
  });
});

describe('buildValidationRetryPrompt', () => {
  it('includes field-level errors', () => {
    const prompt = buildValidationRetryPrompt(
      ['/name: Expected string', '/age: Expected number'],
      TestSchema,
    );
    expect(prompt).toContain('/name: Expected string');
    expect(prompt).toContain('/age: Expected number');
  });

  it('includes JSON format example', () => {
    const prompt = buildValidationRetryPrompt(['/name: Expected string'], TestSchema);
    expect(prompt).toContain('"name"');
    expect(prompt).toContain('"age"');
    expect(prompt).toContain('```json');
  });

  it('instructs JSON-only output', () => {
    const prompt = buildValidationRetryPrompt(['/name: Expected string'], TestSchema);
    expect(prompt).toContain('Output ONLY the corrected JSON object');
  });
});
