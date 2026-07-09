import { describe, it, expect } from 'vitest';
import { PlannerCore } from '../planner/core.js';
import { PlannerError } from '../planner/types.js';
import type { TaskInput } from '../planner/types.js';

function makeTask(id: string, files: string[], deps?: string[], outputs?: string[]): TaskInput {
  return {
    id,
    expectedFiles: files,
    dependsOn: deps,
    producesOutput: outputs,
  };
}

function batchIds(batches: readonly { readonly tasks: readonly { id: string }[] }[]): string[][] {
  return batches.map((b) => b.tasks.map((t) => t.id));
}

describe('PlannerCore.hasFileOverlap', () => {
  it('returns true when tasks share files', () => {
    const a = makeTask('a', ['src/foo.ts', 'src/bar.ts']);
    const b = makeTask('b', ['src/bar.ts', 'src/baz.ts']);
    expect(PlannerCore.hasFileOverlap(a, b)).toBe(true);
  });

  it('returns false when tasks have no shared files', () => {
    const a = makeTask('a', ['src/foo.ts']);
    const b = makeTask('b', ['src/bar.ts']);
    expect(PlannerCore.hasFileOverlap(a, b)).toBe(false);
  });
});

describe('PlannerCore.createPlan', () => {
  const planner = new PlannerCore();

  it('returns empty plan for empty task list', () => {
    const result = planner.createPlan([]);
    expect(result.batches).toHaveLength(0);
    expect(result.totalBatches).toBe(0);
  });

  it('single task → one batch with one task', () => {
    const result = planner.createPlan([makeTask('a', ['src/a.ts'])]);
    expect(result.totalBatches).toBe(1);
    expect(batchIds(result.batches)).toEqual([['a']]);
  });

  it('two tasks, no overlap, no deps → one batch', () => {
    const result = planner.createPlan([makeTask('a', ['src/a.ts']), makeTask('b', ['src/b.ts'])]);
    expect(result.totalBatches).toBe(1);
    expect(batchIds(result.batches)).toEqual([['a', 'b']]);
  });

  it('two tasks touching same file → two separate batches', () => {
    const result = planner.createPlan([
      makeTask('a', ['src/shared.ts']),
      makeTask('b', ['src/shared.ts']),
    ]);
    expect(result.totalBatches).toBe(2);
    const allIds = batchIds(result.batches).flat();
    expect(allIds.sort()).toEqual(['a', 'b']);
    // Each batch should have exactly 1 task
    expect(batchIds(result.batches)[0]).toHaveLength(1);
    expect(batchIds(result.batches)[1]).toHaveLength(1);
  });

  it('explicit dependency → correct ordering', () => {
    const result = planner.createPlan([
      makeTask('a', ['src/a.ts']),
      makeTask('b', ['src/b.ts'], ['a']),
    ]);
    expect(result.totalBatches).toBe(2);
    expect(batchIds(result.batches)).toEqual([['a'], ['b']]);
  });

  it('output dependency (A produces file B needs) → A before B', () => {
    const result = planner.createPlan([
      makeTask('a', ['src/a.ts'], undefined, ['src/b.ts']),
      makeTask('b', ['src/b.ts']),
    ]);
    expect(result.totalBatches).toBe(2);
    expect(batchIds(result.batches)).toEqual([['a'], ['b']]);
  });

  it('chain A→B→C → three batches', () => {
    const result = planner.createPlan([
      makeTask('a', ['src/a.ts']),
      makeTask('b', ['src/b.ts'], ['a']),
      makeTask('c', ['src/c.ts'], ['b']),
    ]);
    expect(result.totalBatches).toBe(3);
    expect(batchIds(result.batches)).toEqual([['a'], ['b'], ['c']]);
  });

  it('diamond A→{B,C}→D (B,C no overlap) → three batches', () => {
    const result = planner.createPlan([
      makeTask('a', ['src/a.ts']),
      makeTask('b', ['src/b.ts'], ['a']),
      makeTask('c', ['src/c.ts'], ['a']),
      makeTask('d', ['src/d.ts'], ['b', 'c']),
    ]);
    expect(result.totalBatches).toBe(3);
    expect(batchIds(result.batches)[0]).toEqual(['a']);
    // B and C should be in the same batch (no overlap)
    const batch1 = batchIds(result.batches)[1] ?? [];
    expect(batch1.sort()).toEqual(['b', 'c']);
    expect(batchIds(result.batches)[2]).toEqual(['d']);
  });

  it('circular dependency A→B→C→A → throws CIRCULAR_DEPENDENCY', () => {
    expect(() =>
      planner.createPlan([
        makeTask('a', ['src/a.ts'], ['c']),
        makeTask('b', ['src/b.ts'], ['a']),
        makeTask('c', ['src/c.ts'], ['b']),
      ]),
    ).toThrow(PlannerError);
  });

  it('invalid dependency reference → throws INVALID_DEPENDENCY', () => {
    expect(() => planner.createPlan([makeTask('a', ['src/a.ts'], ['nonexistent'])])).toThrow(
      PlannerError,
    );
  });

  it('complex mixed scenario: overlap + deps + independent', () => {
    // a depends on nothing, touches file1
    // b depends on a, touches file2
    // c independent, touches file2 (overlaps with b via files, but no dependency)
    // d depends on nothing, touches file3 (independent)
    const result = planner.createPlan([
      makeTask('a', ['file1.ts']),
      makeTask('b', ['file2.ts'], ['a']),
      makeTask('c', ['file2.ts']), // overlaps with b's file
      makeTask('d', ['file3.ts']),
    ]);

    // Expected: batch 0 = [a, c, d] (a can't be with b due to dep, c overlaps with b, d is independent)
    // batch 1 = [b] (depends on a)
    // Actually: a has in-degree 0. b depends on a. c independent but overlaps file2 with b.
    // d independent. So batch 0 candidates = [a, c, d]. c and d both independent.
    // But wait — c overlaps with b, not with a or d. c has no dep on a. c's file2 overlaps with b's file2, but b is not in batch 0.
    // So batch 0 = [a, d, c] (or [a, c, d]). Then batch 1 = [b].

    expect(result.totalBatches).toBeGreaterThanOrEqual(1);
    const allIds = batchIds(result.batches).flat().sort();
    expect(allIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('Batch.batchIndex increments correctly', () => {
    // All tasks touch same file → each in own batch
    const result = planner.createPlan([
      makeTask('a', ['shared.ts']),
      makeTask('b', ['shared.ts']),
      makeTask('c', ['shared.ts']),
    ]);
    expect(result.totalBatches).toBe(3);
    expect(result.batches.map((b) => b.batchIndex)).toEqual([0, 1, 2]);
  });

  it('zero-overlap large set → all in one batch', () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask(`t${String(i)}`, [`file${String(i)}.ts`]),
    );
    const result = planner.createPlan(tasks);
    expect(result.totalBatches).toBe(1);
    expect(result.batches[0]?.tasks).toHaveLength(10);
  });

  it('all tasks overlap with each other → serialized (each in own batch)', () => {
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask(`t${String(i)}`, ['shared.ts']));
    const result = planner.createPlan(tasks);
    expect(result.totalBatches).toBe(5);
    for (const batch of result.batches) {
      expect(batch.tasks).toHaveLength(1);
    }
  });

  // ── Penetration tests ─────────────────────────────────────────────

  it('self-dependency → throws CIRCULAR_DEPENDENCY', () => {
    expect(() => planner.createPlan([makeTask('a', ['src/a.ts'], ['a'])])).toThrow(PlannerError);
  });

  it('duplicate dependency (explicit + output on same pair) does not double-count', () => {
    // Task 'a' depends on 'b' explicitly AND via output (a expects file produced by b)
    const result = planner.createPlan([
      makeTask('a', ['src/a.ts'], ['b']),
      makeTask('b', ['src/b.ts'], undefined, ['src/a.ts']),
    ]);
    // b produces src/a.ts, a expects src/a.ts → output edge b→a
    // a also explicitly depends on b → explicit edge b→a
    // Duplicate edge should not cause double-counting of in-degree
    // Expected: b in batch 0 (in-degree 0), a in batch 1
    expect(result.totalBatches).toBe(2);
    expect(batchIds(result.batches)).toEqual([['b'], ['a']]);
  });

  it('tasks with empty expectedFiles batch together', () => {
    const result = planner.createPlan([makeTask('a', []), makeTask('b', []), makeTask('c', [])]);
    // No files → no overlap → all in one batch, no dependencies
    expect(result.totalBatches).toBe(1);
    expect(result.batches[0]?.tasks).toHaveLength(3);
  });

  it('producesOutput edges are unidirectional (producer→consumer)', () => {
    // Task 'a' produces 'out.ts', task 'b' expects 'out.ts'
    // Edge: a→b (not b→a)
    const result = planner.createPlan([
      makeTask('a', ['src/a.ts'], undefined, ['out.ts']),
      makeTask('b', ['out.ts']),
    ]);
    expect(result.totalBatches).toBe(2);
    expect(batchIds(result.batches)).toEqual([['a'], ['b']]);
  });

  it('output dependency combined with file overlap serializes correctly', () => {
    // a produces shared.ts → b expects shared.ts (output edge a→b)
    // a produces shared.ts → c expects shared.ts (output edge a→c)
    // b and c overlap on shared.ts → separate batches
    // Result: 3 batches (a → b → c or a → c → b)
    const result = planner.createPlan([
      makeTask('a', ['other.ts'], undefined, ['shared.ts']),
      makeTask('b', ['shared.ts']),
      makeTask('c', ['shared.ts']),
    ]);
    expect(result.totalBatches).toBe(3);
    const allIds = batchIds(result.batches).flat().sort();
    expect(allIds).toEqual(['a', 'b', 'c']);
    // a must be first (it's the only one with in-degree 0)
    expect(batchIds(result.batches)[0]).toEqual(['a']);
  });
});
