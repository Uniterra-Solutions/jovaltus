import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { execGit, gitErr } from '../git.js';
import type {
  WorktreeCreateOptions,
  WorktreeDeleteOptions,
  WorktreeEntry,
  WorktreeMergeResult,
} from './types.js';
import { WorktreeError } from './types.js';

export class WorktreeManager {
  private readonly repoPath: string;

  public constructor(repoPath: string) {
    this.repoPath = resolve(repoPath);
  }

  public async create(options: WorktreeCreateOptions): Promise<WorktreeEntry> {
    const args = ['worktree', 'add', '-b', options.branch, options.path];
    if (options.baseBranch) args.push(options.baseBranch);

    try {
      await execGit(args, this.repoPath);
    } catch (err: unknown) {
      const stderr = gitErr(err);
      const code = stderr.includes('already checked out') ? 'BRANCH_EXISTS' : 'WORKTREE_EXISTS';
      throw new WorktreeError(stderr, code, { gitStderr: stderr });
    }

    const entry = await this.get(options.branch);
    if (!entry) throw new WorktreeError('Worktree created but not found', 'GIT_ERROR');
    return entry;
  }

  public async list(): Promise<readonly WorktreeEntry[]> {
    const { stdout } = await this.git(['worktree', 'list', '--porcelain']);
    return this.parseWorktreeList(stdout);
  }

  public async get(branch: string): Promise<WorktreeEntry | undefined> {
    const entries = await this.list();
    return entries.find((e) => e.branch === branch);
  }

  public async merge(branch: string, targetBranch?: string): Promise<WorktreeMergeResult> {
    if (!(await this.get(branch))) {
      throw new WorktreeError(`Worktree for branch "${branch}" not found`, 'NOT_FOUND');
    }

    await this.git(['checkout', targetBranch ?? 'main']);

    try {
      const { stdout } = await execGit(['merge', branch], this.repoPath);
      return { success: true, branch, mergedCommit: stdout.trim().split('\n')[0] || undefined };
    } catch (err: unknown) {
      const msg = gitErr(err);
      if (msg.includes('CONFLICT')) return { success: false, branch, error: msg };
      throw new WorktreeError(`Merge failed: ${msg}`, 'GIT_ERROR', { gitStderr: msg });
    }
  }

  public async remove(branch: string, options?: WorktreeDeleteOptions): Promise<void> {
    const entry = await this.get(branch);
    if (!entry) throw new WorktreeError(`Worktree for branch "${branch}" not found`, 'NOT_FOUND');

    if (!options?.force) {
      const { stdout } = await this.git(['-C', entry.path, 'status', '--porcelain']);
      if (stdout.trim()) {
        throw new WorktreeError(
          `Worktree "${entry.path}" has uncommitted changes. Use force to remove.`,
          'DIRTY_WORKTREE',
        );
      }
    }

    const removeArgs = ['worktree', 'remove'];
    if (options?.force) removeArgs.push('--force');
    removeArgs.push(entry.path);
    await this.git(removeArgs);

    // Non-fatal: clean up the branch
    await this.git(['branch', '-d', branch]).catch(() => {});
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async git(
    args: readonly string[],
  ): Promise<{ readonly stdout: string; readonly stderr: string }> {
    try {
      return await execGit(args, this.repoPath);
    } catch (err: unknown) {
      throw new WorktreeError(`Git command failed: ${gitErr(err)}`, 'GIT_ERROR', {
        gitStderr: gitErr(err),
      });
    }
  }

  private parseWorktreeList(porcelain: string): readonly WorktreeEntry[] {
    const entries: WorktreeEntry[] = [];
    let path = '';
    let head = '';
    let branch = '';

    for (const line of porcelain.split('\n')) {
      if (line.startsWith('worktree ')) {
        path = line.slice(9);
      } else if (line.startsWith('HEAD ')) {
        head = line.slice(5);
      } else if (line.startsWith('branch ')) {
        branch = line.slice(7).replace('refs/heads/', '');
      } else if (line === '' && path && head) {
        entries.push({
          path,
          branch: branch || 'HEAD',
          head,
          isMain: realpathSync(path) === realpathSync(this.repoPath),
        });
        path = head = branch = '';
      }
    }
    // Don't miss the last block if no trailing newline
    if (path && head) {
      entries.push({
        path,
        branch: branch || 'HEAD',
        head,
        isMain: realpathSync(path) === realpathSync(this.repoPath),
      });
    }

    return entries;
  }
}
