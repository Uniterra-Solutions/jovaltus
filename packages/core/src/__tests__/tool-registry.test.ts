import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../agent/tool-registry.js';
import { readTool, writeTool, editTool, bashTool } from '../agent/tools/index.js';

describe('ToolRegistry', () => {
  it('lists all registered tools', () => {
    const r = new ToolRegistry();
    r.register(readTool);
    r.register(bashTool);
    expect(r.list().map((t) => t.name)).toEqual(['read', 'bash']);
  });

  it('selects tools by name', () => {
    const r = new ToolRegistry();
    r.register(readTool);
    r.register(writeTool);
    r.register(editTool);
    r.register(bashTool);
    expect(r.select(['read', 'bash']).map((t) => t.name)).toEqual(['read', 'bash']);
  });

  it('skips unknown names silently', () => {
    const r = new ToolRegistry();
    r.register(readTool);
    expect(r.select(['read', 'nonexistent']).map((t) => t.name)).toEqual(['read']);
  });

  it('gets a tool by name', () => {
    const r = new ToolRegistry();
    r.register(readTool);
    expect(r.get('read')?.name).toBe('read');
    expect(r.get('nonexistent')).toBeUndefined();
  });
});
