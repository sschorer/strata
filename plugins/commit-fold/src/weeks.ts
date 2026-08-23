import type { RawCommit } from '@strata/sdk';
import type { CommitWeek } from './types.js';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Commits per calendar week, oldest first.
 *
 * Weeks start Monday **UTC**: an author's timezone is whatever their laptop
 * said at the time, so bucketing in local time would move a commit between
 * columns depending on who ran the analysis. Weeks nobody committed in are
 * emitted as zero, because a chart that silently closes its gaps draws a busy
 * repository out of a quiet one.
 *
 * Commits whose date git could not give us are skipped rather than dated to
 * the epoch, which would stretch the series across every week since 1970.
 */
export function weeklyActivity(log: readonly RawCommit[]): CommitWeek[] {
  const counts = new Map<number, number>();

  for (const commit of log) {
    const at = Date.parse(commit.date);
    if (Number.isNaN(at)) continue;
    const start = weekStart(at);
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const starts = [...counts.keys()];
  const last = Math.max(...starts);
  const weeks: CommitWeek[] = [];
  // Every start is a Monday midnight UTC, where a week is exactly 7 × 24h.
  for (let at = Math.min(...starts); at <= last; at += WEEK_MS) {
    weeks.push({ week: isoDate(at), commits: counts.get(at) ?? 0 });
  }
  return weeks;
}

/** Monday 00:00 UTC of the week a timestamp falls in. */
function weekStart(at: number): number {
  const d = new Date(at);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  );
  return midnight - sinceMonday * DAY_MS;
}

function isoDate(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}
