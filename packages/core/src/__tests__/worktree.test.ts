import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorktreeManager } from '../worktree/manager.js';
import { WorktreeError } from '../worktree/types.js';

describe('WorktreeManager', () => {
  let repoDir: string;
  let manager: WorktreeManager;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'jovaltus-wt-test-'));
    execFileSync('git', ['init'], { cwd: repoDir });
    execFileSync('git', ['config', 'user.email', 'test@jovaltus.local'], { cwd: repoDir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
    writeFileSync(join(repoDir, 'README.md'), '# test');
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: repoDir });
    manager = new WorktreeManager(repoDir);
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  // ── list() ──────────────────────────────────────────────────────────

  it('list() returns main worktree when no others exist', async () => {
    const entries = await manager.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.isMain).toBe(true);
  });

  it('list() includes created worktrees', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-new');
    try {
      await manager.create({ branch: 'feature-x', path: wtPath });
      const entries = await manager.list();
      expect(entries).toHaveLength(2);
      expect(entries.some((e) => e.branch === 'feature-x')).toBe(true);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  // ── create() ─────────────────────────────────────────────────────────

  it('create() returns a WorktreeEntry', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-create');
    try {
      const entry = await manager.create({ branch: 'feature-a', path: wtPath });
      expect(entry.branch).toBe('feature-a');
      expect(entry.isMain).toBe(false);
      expect(entry.head).toBeTruthy();
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it('create() throws WORKTREE_EXISTS when path is occupied', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-exists');
    try {
      await manager.create({ branch: 'feature-dup', path: wtPath });
      await expect(manager.create({ branch: 'feature-other', path: wtPath })).rejects.toThrow(
        WorktreeError,
      );
      await expect(manager.create({ branch: 'feature-other', path: wtPath })).rejects.toThrow(
        /Already exists/i,
      );
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it('create() throws BRANCH_EXISTS when branch is already checked out', async () => {
    const wtPath1 = join(tmpdir(), 'jovaltus-wt-test-branch1');
    const wtPath2 = join(tmpdir(), 'jovaltus-wt-test-branch2');
    try {
      await manager.create({ branch: 'feature-same', path: wtPath1 });
      await expect(manager.create({ branch: 'feature-same', path: wtPath2 })).rejects.toThrow(
        WorktreeError,
      );

      // Clean up first worktree so we can remove its directory
      await manager.remove('feature-same', { force: true });
    } finally {
      rmSync(wtPath1, { recursive: true, force: true });
      rmSync(wtPath2, { recursive: true, force: true });
    }
  });

  it('create() supports baseBranch option', async () => {
    // First create a branch with content
    execFileSync('git', ['checkout', '-b', 'base-1'], { cwd: repoDir });
    writeFileSync(join(repoDir, 'base.txt'), 'from base');
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['commit', '-m', 'base commit'], { cwd: repoDir });
    execFileSync('git', ['checkout', 'main'], { cwd: repoDir });

    const wtPath = join(tmpdir(), 'jovaltus-wt-test-base');
    try {
      const entry = await manager.create({
        branch: 'from-base',
        path: wtPath,
        baseBranch: 'base-1',
      });
      expect(entry.branch).toBe('from-base');
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  // ── get() ────────────────────────────────────────────────────────────

  it('get() finds worktree by branch name', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-get');
    try {
      await manager.create({ branch: 'feature-get', path: wtPath });
      const entry = await manager.get('feature-get');
      expect(entry).toBeDefined();
      expect(entry?.branch).toBe('feature-get');
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it('get() returns undefined for unknown branch', async () => {
    const entry = await manager.get('nonexistent');
    expect(entry).toBeUndefined();
  });

  // ── remove() ─────────────────────────────────────────────────────────

  it('remove() deletes a worktree', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-remove');
    await manager.create({ branch: 'feature-rm', path: wtPath });
    await manager.remove('feature-rm');

    const entries = await manager.list();
    expect(entries.some((e) => e.branch === 'feature-rm')).toBe(false);
    rmSync(wtPath, { recursive: true, force: true });
  });

  it('remove() with force:true deletes a dirty worktree', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-force');
    await manager.create({ branch: 'feature-force', path: wtPath });
    writeFileSync(join(wtPath, 'dirty.txt'), 'uncommitted');

    await manager.remove('feature-force', { force: true });
    const entries = await manager.list();
    expect(entries.some((e) => e.branch === 'feature-force')).toBe(false);
    rmSync(wtPath, { recursive: true, force: true });
  });

  it('remove() throws DIRTY_WORKTREE for dirty worktree without force', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-dirty');
    try {
      await manager.create({ branch: 'feature-dirty', path: wtPath });
      writeFileSync(join(wtPath, 'dirty.txt'), 'uncommitted');

      await expect(manager.remove('feature-dirty')).rejects.toThrow(WorktreeError);

      // Clean up
      await manager.remove('feature-dirty', { force: true });
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it('remove() throws NOT_FOUND for unknown branch', async () => {
    await expect(manager.remove('nonexistent')).rejects.toThrow(WorktreeError);
  });

  // ── merge() ──────────────────────────────────────────────────────────

  it('merge() succeeds on fast-forward merge', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-merge');
    try {
      await manager.create({ branch: 'feature-merge', path: wtPath });

      // Make a change in the worktree
      writeFileSync(join(wtPath, 'merge.txt'), 'merge content');
      execFileSync('git', ['add', '.'], { cwd: wtPath });
      execFileSync('git', ['commit', '-m', 'merge commit'], { cwd: wtPath });

      const result = await manager.merge('feature-merge');
      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature-merge');
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it('merge() returns { success: false } on conflict (does not throw)', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-conflict');
    try {
      // Create the worktree first
      await manager.create({ branch: 'feature-conflict', path: wtPath });

      // Make a conflicting change in the worktree
      writeFileSync(join(wtPath, 'conflict.txt'), 'feature version');
      execFileSync('git', ['add', '.'], { cwd: wtPath });
      execFileSync('git', ['commit', '-m', 'conflict change'], { cwd: wtPath });

      // Make a divergent change on main (AFTER worktree was created)
      writeFileSync(join(repoDir, 'conflict.txt'), 'main version');
      execFileSync('git', ['add', '.'], { cwd: repoDir });
      execFileSync('git', ['commit', '-m', 'main change'], { cwd: repoDir });

      const result = await manager.merge('feature-conflict');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();

      // Abort the merge
      try {
        execFileSync('git', ['merge', '--abort'], { cwd: repoDir });
      } catch {
        // merge may not have started, ignore
      }
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it('merge() throws NOT_FOUND for unknown branch', async () => {
    await expect(manager.merge('nonexistent')).rejects.toThrow(WorktreeError);
  });

  // ── Full lifecycle ──────────────────────────────────────────────────

  it('full lifecycle: create → get → merge → remove', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-lifecycle');
    try {
      // Create
      const created = await manager.create({ branch: 'feature-lifecycle', path: wtPath });
      expect(created.branch).toBe('feature-lifecycle');

      // Get
      const found = await manager.get('feature-lifecycle');
      expect(found?.path).toBe(created.path);

      // Make a change and merge
      writeFileSync(join(wtPath, 'life.txt'), 'lifecycle');
      execFileSync('git', ['add', '.'], { cwd: wtPath });
      execFileSync('git', ['commit', '-m', 'lifecycle commit'], { cwd: wtPath });

      const merged = await manager.merge('feature-lifecycle');
      expect(merged.success).toBe(true);

      // Remove
      await manager.remove('feature-lifecycle');
      const after = await manager.get('feature-lifecycle');
      expect(after).toBeUndefined();
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
      // If merge left the main in feature branch, switch back
      try {
        execFileSync('git', ['checkout', 'main'], { cwd: repoDir });
      } catch {
        // ignore
      }
    }
  });

  // ── Penetration tests ─────────────────────────────────────────────

  it('merge() supports explicit targetBranch parameter', async () => {
    // Create a side branch to merge into
    execFileSync('git', ['checkout', '-b', 'target-br'], { cwd: repoDir });
    writeFileSync(join(repoDir, 'target.txt'), 'target base');
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['commit', '-m', 'target base'], { cwd: repoDir });
    execFileSync('git', ['checkout', 'main'], { cwd: repoDir });

    const wtPath = join(tmpdir(), 'jovaltus-wt-test-targetbr');
    try {
      await manager.create({ branch: 'feature-target', path: wtPath });
      writeFileSync(join(wtPath, 'ft.txt'), 'feature change');
      execFileSync('git', ['add', '.'], { cwd: wtPath });
      execFileSync('git', ['commit', '-m', 'feature commit'], { cwd: wtPath });

      const result = await manager.merge('feature-target', 'target-br');
      expect(result.success).toBe(true);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
      try {
        execFileSync('git', ['checkout', 'main'], { cwd: repoDir });
      } catch {
        // ignore
      }
    }
  });

  it('merge() throws when targetBranch does not exist', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-badtarget');
    try {
      await manager.create({ branch: 'feature-badtarget', path: wtPath });
      await expect(manager.merge('feature-badtarget', 'nonexistent-branch')).rejects.toThrow(
        WorktreeError,
      );
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
      try {
        execFileSync('git', ['checkout', 'main'], { cwd: repoDir });
      } catch {
        // ignore
      }
    }
  });

  it('create() with invalid baseBranch throws GIT_ERROR', async () => {
    const wtPath = join(tmpdir(), 'jovaltus-wt-test-badbase');
    try {
      await expect(
        manager.create({
          branch: 'feature-badbase',
          path: wtPath,
          baseBranch: 'nonexistent-ref',
        }),
      ).rejects.toThrow(WorktreeError);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });
});
