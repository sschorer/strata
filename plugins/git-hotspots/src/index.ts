import {
  defineGitMetricPlugin,
  type MetricPoint,
  type MetricSeries,
  type RawCommit,
  type RepoContext,
} from '@strata/sdk';
import { churnByPath } from './churn.js';
import { indentComplexity } from './complexity.js';

/**
 * Hotspots = change frequency (churn) × code complexity.
 *
 * The idea (Adam Tornhill, "Your Code as a Crime Scene"): files that both
 * change a lot AND are complex are where bugs and maintenance cost concentrate.
 * Churn we read straight from git history (`churn.ts`); complexity here is a
 * cheap proxy (`complexity.ts`) so the metric has zero language deps.
 */
export default defineGitMetricPlugin({
  id: 'hotspots',
  async compute(ctx: RepoContext, history: RawCommit[]): Promise<MetricSeries> {
    const churn = await churnByPath(ctx, history);

    const points: MetricPoint[] = [];
    for (const file of ctx.files) {
      const changes = churn.get(file.path);
      if (!changes) continue; // only score files that actually churn
      // Complexity depends on the file's contents only — cache it per blob so a
      // rerun re-reads nothing but the files that actually changed.
      const complexity = await ctx.cache.file(file, indentComplexity);
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
