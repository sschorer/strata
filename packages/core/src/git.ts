import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { RawCommit, RepoFile } from '@strata/sdk';

const exec = promisify(execFile);

/** Run a read-only git command in `root` and return stdout. */
export async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd: root,
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

/** Resolve a revision (branch/tag/HEAD) to a concrete commit sha. */
export async function resolveRev(root: string, rev = 'HEAD'): Promise<string> {
  return (await git(root, ['rev-parse', rev])).trim();
}

/** List files tracked at `rev`, each with its blob sha for cache keying. */
export async function listFiles(root: string, rev: string): Promise<RepoFile[]> {
  // `ls-tree -r` gives "<mode> blob <sha>\t<path>" lines.
  const out = await git(root, ['ls-tree', '-r', rev]);
  const files: RepoFile[] = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    const [meta, path] = line.split('\t');
    const parts = meta!.split(/\s+/);
    if (parts[1] !== 'blob') continue; // skip submodules/trees
    const blob = parts[2]!;
    files.push({
      path: path!,
      blob,
      read: async () => git(root, ['cat-file', '-p', blob]),
    });
  }
  return files;
}

const SEP = '\x1e'; // record separator, unlikely to appear in messages

/**
 * Stream commit history as structured records. `paths` narrows to a subtree.
 * `since` limits the window (e.g. a number of commits or a date git accepts).
 */
export async function history(
  root: string,
  opts: { rev?: string; maxCount?: number; paths?: string[] } = {},
): Promise<RawCommit[]> {
  const args = [
    'log',
    opts.rev ?? 'HEAD',
    `--pretty=format:%H${SEP}%an${SEP}%ae${SEP}%aI${SEP}%B${SEP}`,
  ];
  if (opts.maxCount) args.push(`--max-count=${opts.maxCount}`);
  if (opts.paths?.length) args.push('--', ...opts.paths);

  const out = await git(root, args);
  const commits: RawCommit[] = [];
  for (const chunk of out.split(`${SEP}\n`)) {
    if (!chunk.trim()) continue;
    const [sha, author, authorEmail, date, message] = chunk.split(SEP);
    commits.push({
      sha: sha!.trim(),
      author: author ?? '',
      authorEmail: authorEmail ?? '',
      date: date ?? '',
      message: (message ?? '').trim(),
    });
  }
  return commits;
}

/**
 * Per-file change counts (churn) across history — the raw signal behind the
 * hotspot metric. Returns a map of path → number of commits touching it.
 */
export async function churn(
  root: string,
  opts: { rev?: string; maxCount?: number } = {},
): Promise<Map<string, number>> {
  const args = ['log', opts.rev ?? 'HEAD', '--name-only', '--pretty=format:'];
  if (opts.maxCount) args.push(`--max-count=${opts.maxCount}`);
  const out = await git(root, args);
  const counts = new Map<string, number>();
  for (const line of out.split('\n')) {
    const path = line.trim();
    if (!path) continue;
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return counts;
}
