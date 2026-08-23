import type { AnalysisReport } from '$lib/api';
import { outputOf, outputsProducing } from '$lib/stages';

/**
 * The manifest id of the plugin this screen is about.
 *
 * The one place a screen names a producer rather than an output type, and it
 * names it deliberately: the treemap sizes by score and colours by complexity,
 * and churn-and-complexity-behind-a-score is *this* stage's contract, not
 * something every metric series carries. A screen over metric series in general
 * would have nothing to draw a tile with.
 */
export const HOTSPOT_STAGE_ID = 'strata-git-hotspots';

/** One file in the hotspot view: what the treemap sizes and the table ranks. */
export interface HotspotRow {
  path: string;
  /** churn × complexity, straight from the metric. */
  score: number;
  /** Commits that touched the file inside the analysed history window. */
  churn: number;
  complexity: number;
  /** From the stages that produced a graph; `null` for a file none measured. */
  loc: number | null;
}

/**
 * Fold a report into the rows both panels read.
 *
 * The hotspot stage's series carries the score and its two factors; lines of
 * code come from whichever stage analysed the file into a graph, so the two are
 * joined here rather than in a component. Files with no score are not hotspots
 * and drop out.
 *
 * Empty when the hotspot stage produced nothing — because it failed, because it
 * never ran, or because no such stage is installed. Those are not the same
 * answer as "no file scored", and the screen asks `troubleOf` which it is
 * rather than reading an empty ranking as one of them.
 */
export function hotspotRows(report: AnalysisReport): HotspotRow[] {
  const series = outputOf(report, HOTSPOT_STAGE_ID, 'metrics');
  if (!series) return [];

  const loc = locByPath(report);
  return series.points
    .map((point) => ({
      path: point.subject,
      score: point.value,
      churn: metaNumber(point.meta, 'churn'),
      complexity: metaNumber(point.meta, 'complexity'),
      loc: loc.get(point.subject) ?? null,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Every graph stage's per-file `metrics`, flattened to `path → loc`. */
function locByPath(report: AnalysisReport): Map<string, number> {
  const loc = new Map<string, number>();
  for (const { output } of outputsProducing(report, 'graph')) {
    for (const metric of output.metrics) loc.set(metric.path, metric.loc);
  }
  return loc;
}

/**
 * `meta` is `Record<string, number | string>` by contract, and a stage other
 * than the hotspot one may fill it differently — anything unusable reads as 0.
 */
function metaNumber(
  meta: Record<string, number | string> | undefined,
  key: string,
): number {
  const value = Number(meta?.[key]);
  return Number.isFinite(value) ? value : 0;
}
