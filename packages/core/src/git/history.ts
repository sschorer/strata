import type { RawCommit } from '@strata/sdk';
import { git } from './exec.js';

const SEP = '\x1e'; // record separator, unlikely to appear in messages

/**
 * Stream commit history as structured records. `paths` narrows to a subtree.
 * `maxCount` limits the window (number of commits).
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
