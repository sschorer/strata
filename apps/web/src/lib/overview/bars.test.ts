import { describe, expect, it } from 'vitest';
import type { HotspotRow } from '$lib/hotspots';
import { hotspotBars } from './bars';

const row = (path: string, score: number): HotspotRow => ({
  path,
  score,
  churn: 1,
  complexity: score,
  loc: null,
});

describe('hotspotBars', () => {
  it('measures every bar against the top-ranked file', () => {
    const bars = hotspotBars([row('a.ts', 400), row('b.ts', 100)]);

    expect(bars.map((bar) => bar.share)).toEqual([1, 0.25]);
  });

  it('keeps the widths of the report when the list is cut short', () => {
    const rows = [row('a.ts', 400), row('b.ts', 100), row('c.ts', 40)];

    // Two rows of the same three: the head keeps the width it had, so a short
    // list does not promote the runner-up to a full bar.
    expect(hotspotBars(rows, 2).map((bar) => bar.share)).toEqual([1, 0.25]);
  });

  it('carries the complexity the ramp colours by', () => {
    expect(hotspotBars([row('a.ts', 400)])[0]).toMatchObject({
      path: 'a.ts',
      score: 400,
      complexity: 400,
    });
  });

  it('has no widths at all when nothing scored', () => {
    expect(hotspotBars([])).toEqual([]);
    expect(hotspotBars([row('a.ts', 0)])[0]!.share).toBe(0);
  });
});
