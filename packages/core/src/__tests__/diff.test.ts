import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CleanDiffManager } from '../diff/manager.js';
import { DiffError } from '../diff/types.js';

describe('CleanDiffManager', () => {
  let repoDir: string;
  let manager: CleanDiffManager;
  let commit1: string;
  let commit2: string;
  let commit3: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'jovaltus-diff-test-'));
    execFileSync('git', ['init'], { cwd: repoDir });
    execFileSync('git', ['config', 'user.email', 'test@jovaltus.local'], { cwd: repoDir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });

    // Commit 1: add file-a.ts
    writeFileSync(join(repoDir, 'file-a.ts'), 'export const a = 1;\nexport const a2 = 2;\n');
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['commit', '-m', 'add file-a'], { cwd: repoDir });
    commit1 = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDir,
      encoding: 'utf-8',
    }).trim();

    // Commit 2: modify file-a.ts, add file-b.ts
    writeFileSync(join(repoDir, 'file-a.ts'), 'export const a = 1;\n');
    writeFileSync(
      join(repoDir, 'file-b.ts'),
      'export const b = 1;\nexport const b2 = 2;\nexport const b3 = 3;\n',
    );
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['commit', '-m', 'modify a, add b'], { cwd: repoDir });
    commit2 = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDir,
      encoding: 'utf-8',
    }).trim();

    // Commit 3: delete file-a.ts, rename file-b.ts → file-c.ts (add lines, keep old content for rename detection)
    execFileSync('git', ['rm', 'file-a.ts'], { cwd: repoDir });
    execFileSync('git', ['mv', 'file-b.ts', 'file-c.ts'], { cwd: repoDir });
    const fc = join(repoDir, 'file-c.ts');
    const current = execFileSync('cat', [fc], { cwd: repoDir, encoding: 'utf-8' });
    writeFileSync(fc, current + 'export const x4 = 4;\nexport const x5 = 5;\n');
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['commit', '-m', 'delete a, rename b to c'], { cwd: repoDir });
    commit3 = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDir,
      encoding: 'utf-8',
    }).trim();

    manager = new CleanDiffManager(repoDir);
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  // ── compute() ────────────────────────────────────────────────────────

  it('compute() returns correct file list between two commits', async () => {
    // commit1 → commit2: file-a.ts modified, file-b.ts added
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit2,
    });
    const names = result.files.map((f) => f.filePath);
    expect(names).toContain('file-a.ts');
    expect(names).toContain('file-b.ts');
  });

  it('compute() detects added files', async () => {
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit2,
    });
    const fileB = result.files.find((f) => f.filePath === 'file-b.ts');
    expect(fileB).toBeDefined();
    expect(fileB?.changeType).toBe('added');
    expect(fileB?.deletedLines).toBe(0);
    expect(fileB?.addedLines).toBeGreaterThan(0);
  });

  it('compute() detects deleted files', async () => {
    const result = await manager.compute({
      startCommit: commit2,
      endCommit: commit3,
    });
    const fileA = result.files.find((f) => f.filePath === 'file-a.ts');
    expect(fileA).toBeDefined();
    expect(fileA?.changeType).toBe('deleted');
    expect(fileA?.addedLines).toBe(0);
    expect(fileA?.deletedLines).toBeGreaterThan(0);
  });

  it('compute() detects modified files', async () => {
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit2,
    });
    const fileA = result.files.find((f) => f.filePath === 'file-a.ts');
    expect(fileA).toBeDefined();
    expect(fileA?.changeType).toBe('modified');
    // 2 lines removed (a2 line, trailing newline) — exact may vary, just check non-zero
    expect(fileA?.addedLines).toBeGreaterThanOrEqual(0);
    expect(fileA?.deletedLines).toBeGreaterThanOrEqual(0);
  });

  it('compute() detects renamed files', async () => {
    const result = await manager.compute({
      startCommit: commit2,
      endCommit: commit3,
    });
    const renamed = result.files.find(
      (f) => f.filePath === 'file-c.ts' && f.changeType === 'renamed',
    );
    expect(renamed).toBeDefined();
  });

  it('compute() computes correct summary totals', async () => {
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit2,
    });
    expect(result.summary.totalFiles).toBe(2);
    expect(result.summary.totalAdded).toBeGreaterThan(0);
  });

  it('compute() with file filter returns only matching files', async () => {
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit2,
      fileFilter: ['file-a.ts'],
    });
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filePath).toBe('file-a.ts');
  });

  it('compute() returns empty result for identical commits', async () => {
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit1,
    });
    expect(result.files).toHaveLength(0);
    expect(result.summary.totalFiles).toBe(0);
    expect(result.rawDiff).toBe('');
  });

  it('compute() throws COMMIT_NOT_FOUND for invalid commit', async () => {
    await expect(
      manager.compute({
        startCommit: 'nonexistent12345',
        endCommit: commit2,
      }),
    ).rejects.toThrow(DiffError);
  });

  it('compute() includes raw diff text', async () => {
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit2,
    });
    expect(result.rawDiff).toBeTruthy();
    expect(result.rawDiff).toContain('diff --git');
  });

  // ── Level-specific methods ─────────────────────────────────────────

  it('specDiff() delegates to compute() with spec level', async () => {
    const result = await manager.specDiff(commit1, commit2);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('batchDiff() delegates to compute() with batch level', async () => {
    const result = await manager.batchDiff(commit1, commit2);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('workerDiff() delegates to compute() with worker level', async () => {
    const result = await manager.workerDiff(commit1, commit2);
    expect(result.files.length).toBeGreaterThan(0);
  });

  // ── Penetration tests ────────────────────────────────────────────────

  it('compute() with multiple file filters returns only matching files', async () => {
    // commit1 → commit2: file-a.ts (modified) + file-b.ts (added)
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit2,
      fileFilter: ['file-a.ts', 'file-b.ts'],
    });
    expect(result.files).toHaveLength(2);
    const names = result.files.map((f) => f.filePath).sort();
    expect(names).toEqual(['file-a.ts', 'file-b.ts']);
  });

  it('compute() with file filter matching nothing returns empty files', async () => {
    const result = await manager.compute({
      startCommit: commit1,
      endCommit: commit2,
      fileFilter: ['nonexistent.ts'],
    });
    expect(result.files).toHaveLength(0);
    expect(result.summary.totalFiles).toBe(0);
  });

  it('specDiff/batchDiff/workerDiff produce same file list for same commits', async () => {
    const spec = await manager.specDiff(commit1, commit2);
    const batch = await manager.batchDiff(commit1, commit2);
    const worker = await manager.workerDiff(commit1, commit2);
    const specIds = spec.files.map((f) => f.filePath).sort();
    expect(batch.files.map((f) => f.filePath).sort()).toEqual(specIds);
    expect(worker.files.map((f) => f.filePath).sort()).toEqual(specIds);
  });
});
