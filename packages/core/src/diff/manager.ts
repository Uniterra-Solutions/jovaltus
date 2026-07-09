import { execGit, gitErr } from '../git.js';
import type { ChangeType, DiffFileEntry, DiffRequest, DiffResult } from './types.js';
import { DiffError } from './types.js';

const MAX_DIFF_BYTES = 50_000;

const STATUS_MAP: Record<string, ChangeType> = { A: 'added', D: 'deleted', M: 'modified' };

export class CleanDiffManager {
  private readonly repoPath: string;

  public constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  public async compute({ startCommit, endCommit, fileFilter }: DiffRequest): Promise<DiffResult> {
    if (startCommit === endCommit) {
      return { files: [], summary: { totalAdded: 0, totalDeleted: 0, totalFiles: 0 }, rawDiff: '' };
    }

    const fileArgs: readonly string[] = fileFilter?.length ? ['--', ...fileFilter] : [];
    const baseArgs = ['--find-renames', startCommit, endCommit, ...fileArgs];

    try {
      const [numstatResult, diffResult, nameStatusResult] = await Promise.all([
        this.git(['diff', '--numstat', ...baseArgs]),
        this.git(['diff', '--patch', ...baseArgs]),
        this.git(['diff', '--name-status', ...baseArgs]),
      ]);

      const statusMap = this.parseNameStatus(nameStatusResult.stdout);
      const files = this.parseNumstat(numstatResult.stdout, statusMap);
      const rawDiff =
        diffResult.stdout.length > MAX_DIFF_BYTES
          ? `... (truncated)\n${diffResult.stdout.slice(-MAX_DIFF_BYTES)}`
          : diffResult.stdout;

      return {
        files,
        rawDiff,
        summary: {
          totalAdded: files.reduce((s, f) => s + f.addedLines, 0),
          totalDeleted: files.reduce((s, f) => s + f.deletedLines, 0),
          totalFiles: files.length,
        },
      };
    } catch (err: unknown) {
      if (err instanceof DiffError) throw err;
      const msg = gitErr(err);
      if (/unknown revision|bad revision|ambiguous argument/i.test(msg)) {
        throw new DiffError(`Commit not found: ${msg}`, 'COMMIT_NOT_FOUND', { gitStderr: msg });
      }
      throw new DiffError(`Git diff failed: ${msg}`, 'GIT_ERROR', { gitStderr: msg });
    }
  }

  public async specDiff(specStart: string, specEnd: string): Promise<DiffResult> {
    return this.compute({ startCommit: specStart, endCommit: specEnd, level: 'spec' });
  }

  public async batchDiff(batchStart: string, batchEnd: string): Promise<DiffResult> {
    return this.compute({ startCommit: batchStart, endCommit: batchEnd, level: 'batch' });
  }

  public async workerDiff(workerStart: string, workerEnd: string): Promise<DiffResult> {
    return this.compute({ startCommit: workerStart, endCommit: workerEnd, level: 'worker' });
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async git(
    args: readonly string[],
  ): Promise<{ readonly stdout: string; readonly stderr: string }> {
    return execGit(args, this.repoPath);
  }

  private parseNameStatus(output: string): ReadonlyMap<string, ChangeType> {
    const map = new Map<string, ChangeType>();
    for (const line of output.split('\n')) {
      const parts = line.split('\t');
      const status = parts[0] ?? '';
      if (status.startsWith('R') && parts[2]) {
        map.set(parts[2], 'renamed');
      } else if (parts[1]) {
        const code = status[0];
        const changeType: ChangeType | undefined =
          code !== undefined ? STATUS_MAP[code] : undefined;
        if (changeType) map.set(parts[1], changeType);
      }
    }
    return map;
  }

  private parseNumstat(
    numstat: string,
    statusMap: ReadonlyMap<string, ChangeType>,
  ): readonly DiffFileEntry[] {
    const files: DiffFileEntry[] = [];
    for (const line of numstat.split('\n')) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;

      const addedLines = parts[0] === '-' ? 0 : parseInt(parts[0] ?? '0', 10);
      const deletedLines = parts[1] === '-' ? 0 : parseInt(parts[1] ?? '0', 10);
      let filePath = parts.slice(2).join('\t');

      // Handle rename numstat format: "old => new"
      const arrow = filePath.lastIndexOf(' => ');
      if (arrow !== -1) filePath = filePath.slice(arrow + 4);

      files.push({
        filePath,
        addedLines,
        deletedLines,
        changeType: statusMap.get(filePath) ?? 'modified',
      });
    }
    return files;
  }
}
