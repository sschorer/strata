import type { ProjectAnalysis } from '$lib/api';
import { compactNumber, formatDuration, relativeAge } from '$lib/format';

/** One row of the recents list — strings, ready to paint. */
export interface RecentRow {
  /** The finish timestamp; also the row's identity in the list. */
  id: string;
  /** Short revision, as everything else in the UI abbreviates it. */
  rev: string;
  /** Branch of the analysed revision; `detached` when the rev names none. */
  branch: string;
  files: string;
  duration: string;
  age: string;
}

const SHORT_REV = 8;

/**
 * The log as it reads: same abbreviations the header's run summary uses, so
 * the last row and the chips above the screen say the same thing about the
 * same run.
 */
export function recentRows(
  runs: readonly ProjectAnalysis[],
  now: number = Date.now(),
): RecentRow[] {
  return runs.map((run) => ({
    id: run.finishedAt,
    rev: run.rev.slice(0, SHORT_REV),
    branch: run.branch ?? 'detached',
    files: compactNumber(run.files),
    duration: formatDuration(run.durationMs),
    age: relativeAge(run.finishedAt, now),
  }));
}
