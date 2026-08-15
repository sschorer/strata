/**
 * Analysis numbers run from single digits into the millions on a large repo —
 * hotspot scores, lines of code, edge counts. A table or a stat panel has to
 * stay scannable at both ends, so anything past a thousand is abbreviated and
 * only the leading digits are kept.
 */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  if (Math.abs(rounded) < 1000) return String(rounded);

  const units = [
    { limit: 1e9, suffix: 'B' },
    { limit: 1e6, suffix: 'M' },
    { limit: 1e3, suffix: 'k' },
  ];
  for (const { limit, suffix } of units) {
    if (Math.abs(rounded) >= limit) {
      const scaled = rounded / limit;
      const digits = Math.abs(scaled) < 10 ? 1 : 0;
      return `${scaled.toFixed(digits)}${suffix}`;
    }
  }
  return String(rounded);
}
