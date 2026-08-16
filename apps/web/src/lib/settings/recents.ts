import type { AnalysisReport, ProjectAnalysis } from '$lib/api';

/**
 * The runs a project has behind it. The registry keeps one summary per project
 * — the last one — so a list of several is this browser's own log, seeded with
 * the run the server knows about; see `recents-storage.ts` for where it is
 * kept.
 *
 * A run is identified by when it finished: the same analysis folded in twice
 * (the screen records the run it started, and re-opens on the registry's copy
 * of it) is one entry, not two.
 */
export const RECENT_LIMIT = 8;

/** What one finished report leaves behind — the registry's own shape. */
export function runEntry(report: AnalysisReport): ProjectAnalysis {
  return { rev: report.rev, ...report.run };
}

/**
 * Fold a run into the log: newest first, capped, and a run already in it
 * changes nothing — the **same list** comes back, so a caller can tell "this
 * is new" from identity alone rather than by comparing entries.
 */
export function mergeRun(
  runs: readonly ProjectAnalysis[],
  entry: ProjectAnalysis,
  limit: number = RECENT_LIMIT,
): readonly ProjectAnalysis[] {
  if (runs.some((run) => run.finishedAt === entry.finishedAt)) return runs;
  return [...runs, entry].sort(byNewest).slice(0, limit);
}

/** A timestamp that cannot be read sorts last rather than shuffling the list. */
function byNewest(a: ProjectAnalysis, b: ProjectAnalysis): number {
  return at(b.finishedAt) - at(a.finishedAt);
}

function at(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}
