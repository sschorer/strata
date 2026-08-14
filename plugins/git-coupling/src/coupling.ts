import type { MetricPoint } from '@strata/sdk';
import { splitPair, type CoChanges } from './pairs.js';

/** Thresholds that decide which pairs are worth reporting. */
export interface CouplingOptions {
  /** Ignore a file that changed fewer times than this — too little evidence. */
  minChanges: number;
  /** Ignore a pair that changed together fewer times than this. */
  minSharedChanges: number;
  /** Ignore a pair coupled below this percentage. */
  minDegree: number;
  /** Keep at most this many pairs; pairs are quadratic, reports are read by humans. */
  limit: number;
}

/** The pair separator shown in a point's subject. */
const SUBJECT_SEP = ' ↔ ';

/**
 * Rank co-changing pairs by coupling degree.
 *
 * Degree is the share of a pair's changes that were shared, against the
 * *average* of the two files' change counts (as in Tornhill's code-maat):
 *
 *     degree = 100 × shared / ((changesA + changesB) / 2)
 *
 * Averaging keeps the metric symmetric and stops a file that changes constantly
 * (a barrel, a lockfile) from reading as tightly coupled to everything it
 * happens to accompany. 100% means the two files never changed apart.
 *
 * `present` limits the result to files that still exist at the analysed
 * revision — a pair whose files were both deleted is history, not a warning.
 */
export function rankCoupling(
  { changes, shared }: CoChanges,
  present: ReadonlySet<string>,
  opts: CouplingOptions,
): MetricPoint[] {
  const points: MetricPoint[] = [];

  for (const [key, sharedChanges] of shared) {
    if (sharedChanges < opts.minSharedChanges) continue;
    const [a, b] = splitPair(key);
    if (!present.has(a) || !present.has(b)) continue;

    const changesA = changes.get(a) ?? 0;
    const changesB = changes.get(b) ?? 0;
    if (changesA < opts.minChanges || changesB < opts.minChanges) continue;

    const degree = round((200 * sharedChanges) / (changesA + changesB));
    if (degree < opts.minDegree) continue;

    points.push({
      subject: `${a}${SUBJECT_SEP}${b}`,
      value: degree,
      // Both paths separately too, so a UI can link them without re-splitting
      // the subject.
      meta: { fileA: a, fileB: b, sharedChanges, changesA, changesB },
    });
  }

  // Degree first, then the better-evidenced pair, then the path — a stable
  // order, so two runs over the same history render identically.
  points.sort(
    (x, y) =>
      y.value - x.value ||
      (y.meta!.sharedChanges as number) - (x.meta!.sharedChanges as number) ||
      x.subject.localeCompare(y.subject),
  );
  return points.slice(0, opts.limit);
}

/** One decimal is as much precision as a percentage over a few commits earns. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
