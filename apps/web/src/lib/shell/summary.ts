import type { AnalysisReport } from '$lib/api';
import { compactNumber, formatDuration, relativeAge } from '$lib/format';

/** The last run, as the header prints it — strings, ready to paint. */
export interface RunDisplay {
  /** Branch of the analysed revision; `detached` when the rev names no branch. */
  branch: string;
  /** Short revision, as everything else in the UI abbreviates it. */
  rev: string;
  files: string;
  duration: string;
  age: string;
}

const SHORT_REV = 8;

export function runDisplay(
  report: AnalysisReport,
  now: number = Date.now(),
): RunDisplay {
  // Every report the server sends carries a run summary; the fallbacks keep
  // the header printable rather than blank if one ever arrives without.
  const run = report.run as AnalysisReport['run'] | undefined;
  return {
    branch: run?.branch ?? 'detached',
    rev: report.rev.slice(0, SHORT_REV),
    files: compactNumber(run?.files ?? 0),
    duration: formatDuration(run?.durationMs ?? Number.NaN),
    age: run?.finishedAt ? relativeAge(run.finishedAt, now) : '—',
  };
}
