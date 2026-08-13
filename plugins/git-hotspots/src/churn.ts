import type { RawCommit, RepoContext } from '@strata/sdk';

/**
 * How many commits touched each path. Walks back exactly the commits we were
 * given from the newest sha — this stays correct even when the window reaches
 * the repo's root commit (which has no parent).
 */
export async function churnByPath(
  ctx: RepoContext,
  history: RawCommit[],
): Promise<Map<string, number>> {
  const churn = new Map<string, number>();
  if (history.length === 0) return churn;

  const out = await ctx.git([
    'log',
    '--name-only',
    '--pretty=format:',
    '-n',
    String(history.length),
    history[0]!.sha,
  ]);
  for (const line of out.split('\n')) {
    const path = line.trim();
    if (path) churn.set(path, (churn.get(path) ?? 0) + 1);
  }
  return churn;
}
