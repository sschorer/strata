import { git } from './exec.js';

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
