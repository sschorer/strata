/**
 * How long ago something happened. The header prints the last run's age next
 * to the branch and revision chips and re-reads it on a timer, so it has to
 * stay short, never wrap, and degrade quietly on a timestamp it cannot parse.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function relativeAge(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '—';

  const elapsed = now - at;
  // A browser clock a few seconds behind the server must not print a future.
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)} d ago`;
  return `${Math.floor(elapsed / WEEK)} w ago`;
}
