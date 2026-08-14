import type { AnalysisReport } from '$lib/api';

/** The id the `git-hotspots` plugin publishes its series under. */
export const HOTSPOT_SERIES_ID = 'hotspots';

/** One file in the hotspot view: what the treemap sizes and the table ranks. */
export interface HotspotRow {
  path: string;
  /** churn × complexity, straight from the metric. */
  score: number;
  /** Commits that touched the file inside the analysed history window. */
  churn: number;
  complexity: number;
  /** From the language plugins; `null` for a file no language claimed. */
  loc: number | null;
}

/**
 * Fold a report into the rows both panels read.
 *
 * The hotspot series carries the score and its two factors; lines of code come
 * from whichever language plugin analysed the file, so the two are joined here
 * rather than in a component. Files with no score are not hotspots and drop out.
 */
export function hotspotRows(report: AnalysisReport): HotspotRow[] {
  const series = report.metrics.find((s) => s.id === HOTSPOT_SERIES_ID);
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

/** Every language's `metrics`, flattened to `path → loc`. */
function locByPath(report: AnalysisReport): Map<string, number> {
  const loc = new Map<string, number>();
  for (const language of Object.values(report.languages)) {
    for (const metric of language.metrics) loc.set(metric.path, metric.loc);
  }
  return loc;
}

/**
 * `meta` is `Record<string, number | string>` by contract, and a plugin other
 * than `git-hotspots` may fill it differently — anything unusable reads as 0.
 */
function metaNumber(
  meta: Record<string, number | string> | undefined,
  key: string,
): number {
  const value = Number(meta?.[key]);
  return Number.isFinite(value) ? value : 0;
}
