import type { RawCommit, RepoContext } from '@strata/sdk';

/** Record separator; `--pretty=format:%x1e` prints it once per commit. */
const SEP = '\x1e';

/**
 * The set of paths each analysed commit touched, newest first.
 *
 * Reads exactly the commits we were given by walking back from the newest sha,
 * the same window `git-hotspots` uses — so a history cap applies consistently
 * across metrics and the walk stays correct at the repo's root commit.
 *
 * A merge commit shows no files under `--name-only` and yields an empty set,
 * which is what we want: its changes were already counted on the merged side.
 */
export async function changedFilesByCommit(
  ctx: RepoContext,
  history: RawCommit[],
): Promise<string[][]> {
  if (history.length === 0) return [];

  const out = await ctx.git([
    'log',
    '--name-only',
    `--pretty=format:${SEP}`,
    '-n',
    String(history.length),
    history[0]!.sha,
  ]);

  const commits: string[][] = [];
  for (const chunk of out.split(SEP)) {
    // Only empty lines are dropped, never trimmed: a leading or trailing space
    // is part of a git path, and a trimmed one stops matching `ctx.files`.
    // A set, so a path listed twice in one commit still counts as one change.
    const paths = new Set(chunk.split('\n').filter((line) => line.length > 0));
    if (paths.size > 0) commits.push([...paths]);
  }
  return commits;
}
