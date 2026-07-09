import type { Batch, PlanResult, TaskInput, TaskNode } from './types.js';
import { PlannerError } from './types.js';

export class PlannerCore {
  public static hasFileOverlap(a: TaskInput, b: TaskInput): boolean {
    const set = new Set(a.expectedFiles);
    return b.expectedFiles.some((f) => set.has(f));
  }

  public createPlan(tasks: readonly TaskInput[]): PlanResult {
    if (tasks.length === 0) return { batches: [], totalBatches: 0 };

    // Validate + build nodes
    const allIds = new Set(tasks.map((t) => t.id));
    const nodeMap = new Map<string, TaskNode>();

    for (const t of tasks) {
      if (t.dependsOn) {
        for (const depId of t.dependsOn) {
          if (!allIds.has(depId)) {
            throw new PlannerError(
              `Task "${t.id}" depends on unknown task "${depId}"`,
              'INVALID_DEPENDENCY',
              { affectedTasks: [t.id, depId] },
            );
          }
        }
      }
      nodeMap.set(t.id, {
        id: t.id,
        expectedFiles: t.expectedFiles,
        producesOutput: t.producesOutput ?? [],
      });
    }

    // Build dependency graph
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    for (const id of allIds) {
      graph.set(id, new Set());
      inDegree.set(id, 0);
    }

    const addEdge = (from: string, to: string): void => {
      const deps = graph.get(from);
      const deg = inDegree.get(to);
      if (!deps || deg === undefined) return;
      if (!deps.has(to)) {
        deps.add(to);
        inDegree.set(to, deg + 1);
      }
    };

    for (const task of tasks) {
      // Explicit dependencies
      for (const depId of task.dependsOn ?? []) addEdge(depId, task.id);

      // Output-based dependencies
      if (task.producesOutput?.length) {
        const outputSet = new Set(task.producesOutput);
        for (const other of tasks) {
          if (other.id !== task.id && other.expectedFiles.some((f) => outputSet.has(f))) {
            addEdge(task.id, other.id);
          }
        }
      }
    }

    // Cycle detection (DFS three-color)
    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const color = new Map<string, number>();
    for (const id of allIds) color.set(id, WHITE);

    const cyclePath: string[] = [];
    const dfs = (node: string): boolean => {
      if (color.get(node) === GRAY) {
        cyclePath.push(node);
        return true;
      }
      if (color.get(node) === BLACK) return false;
      color.set(node, GRAY);
      cyclePath.push(node);
      for (const neighbor of graph.get(node) ?? new Set()) {
        if (dfs(neighbor)) return true;
      }
      color.set(node, BLACK);
      cyclePath.pop();
      return false;
    };

    for (const id of allIds) {
      if (color.get(id) === WHITE && dfs(id)) {
        throw new PlannerError('Circular dependency detected', 'CIRCULAR_DEPENDENCY', {
          affectedTasks: [...cyclePath],
        });
      }
      cyclePath.length = 0;
    }

    // Kahn's algorithm with overlap-aware batching
    const unprocessed = new Set(allIds);
    const remaining = new Map(inDegree);
    const batches: Batch[] = [];

    while (unprocessed.size > 0) {
      // Collect nodes with in-degree 0
      const pool: TaskNode[] = [];
      for (const id of unprocessed) {
        if (remaining.get(id) === 0) {
          const node = nodeMap.get(id);
          if (node) pool.push(node);
        }
      }

      // Greedily select non-overlapping subset
      const batch = this.selectNonOverlapping(pool);
      batches.push({ tasks: batch, batchIndex: batches.length });

      for (const node of batch) {
        unprocessed.delete(node.id);
        for (const dep of graph.get(node.id) ?? new Set()) {
          const deg = remaining.get(dep);
          if (deg !== undefined) remaining.set(dep, deg - 1);
        }
      }
    }

    return { batches, totalBatches: batches.length };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private selectNonOverlapping(pool: readonly TaskNode[]): TaskNode[] {
    if (pool.length <= 1) return [...pool];

    // Sort by conflict count ascending — fewer conflicts picked first
    const ranked = pool.map((task) => {
      let conflicts = 0;
      for (const other of pool) {
        if (other.id !== task.id && PlannerCore.hasFileOverlap(task, other)) conflicts++;
      }
      return { task, conflicts };
    });
    ranked.sort((a, b) => a.conflicts - b.conflicts);

    const selected: TaskNode[] = [];
    for (const { task } of ranked) {
      if (!selected.some((s) => PlannerCore.hasFileOverlap(task, s))) {
        selected.push(task);
      }
    }

    return selected;
  }
}
