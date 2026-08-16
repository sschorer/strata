/**
 * How long a run took, in the shortest form that still reads exactly: an
 * incremental analysis lands in milliseconds and a cold one over a large
 * repository takes minutes, and the header prints both in the same slot.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;

  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;

  // Round to whole seconds first: rounding the remainder on its own turns
  // 119.6 s into "1 m 60 s".
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${minutes} m` : `${minutes} m ${rest} s`;
}
