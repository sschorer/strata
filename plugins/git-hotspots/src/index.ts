import {
  defineGitMetricPlugin,
  type MetricPoint,
  type MetricSeries,
  type RawCommit,
  type RepoContext,
} from '@strata/sdk';

/**
 * Hotspots = change frequency (churn) × code complexity.
 *
 * The idea (Adam Tornhill, "Your Code as a Crime Scene"): files that both
 * change a lot AND are complex are where bugs and maintenance cost concentrate.
 * Churn we read straight from git history; complexity here is a cheap proxy
 * (indentation-weighted line count) so the metric has zero language deps — a
 * LanguagePlugin can later supply real cyclomatic complexity to sharpen it.
 */
export default defineGitMetricPlugin({
  id: 'hotspots',
  async compute(ctx: RepoContext, history: RawCommit[]): Promise<MetricSeries> {
    // 1. Churn: how many commits touched each path. Walk back exactly the
    //    commits we were given from the newest sha — this stays correct even
    //    when the window reaches the repo's root commit (which has no parent).
    const churn = new Map<string, number>();
    if (history.length) {
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
    }

    // 2. Complexity proxy for each currently-tracked file.
    const points: MetricPoint[] = [];
    for (const file of ctx.files) {
      const changes = churn.get(file.path);
      if (!changes) continue; // only score files that actually churn
      const complexity = await indentComplexity(file);
      points.push({
        subject: file.path,
        value: changes * complexity,
        meta: { churn: changes, complexity },
      });
    }

    points.sort((a, b) => b.value - a.value);
    return {
      id: 'hotspots',
      label: 'Hotspots (churn × complexity)',
      points,
    };
  },
});

/** Sum of leading-whitespace depth per non-blank line — a fast complexity proxy. */
async function indentComplexity(file: {
  read(): Promise<string>;
}): Promise<number> {
  const text = await file.read();
  let score = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    score += 1 + Math.floor(indent / 2);
  }
  return score;
}
