import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '$lib/api';
import { hotspotRows } from './rows';

function report(partial: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    rev: 'abc123',
    languages: {},
    metrics: [],
    commits: [],
    cache: {
      enabled: false,
      hits: 0,
      misses: 0,
      runHits: 0,
      runMisses: 0,
      writes: 0,
    },
    ...partial,
  };
}

const hotspots = {
  id: 'hotspots',
  label: 'Hotspots (churn × complexity)',
  points: [
    { subject: 'src/a.ts', value: 300, meta: { churn: 10, complexity: 30 } },
    { subject: 'src/b.ts', value: 900, meta: { churn: 9, complexity: 100 } },
  ],
};

describe('hotspotRows', () => {
  it('joins the metric with the language plugins line counts', () => {
    const rows = hotspotRows(
      report({
        metrics: [hotspots],
        languages: {
          typescript: {
            graph: { nodes: [], edges: [], cycles: [] },
            deadCode: [],
            metrics: [{ path: 'src/a.ts', loc: 120 }],
          },
        },
      }),
    );

    expect(rows).toEqual([
      { path: 'src/b.ts', score: 900, churn: 9, complexity: 100, loc: null },
      { path: 'src/a.ts', score: 300, churn: 10, complexity: 30, loc: 120 },
    ]);
  });

  it('is empty when no plugin published the series', () => {
    expect(hotspotRows(report({ metrics: [{ id: 'other', label: 'x', points: [] }] })))
      .toEqual([]);
  });

  it('drops unscored files and reads missing meta as zero', () => {
    const rows = hotspotRows(
      report({
        metrics: [
          {
            id: 'hotspots',
            label: 'Hotspots',
            points: [
              { subject: 'src/zero.ts', value: 0, meta: { churn: 1 } },
              { subject: 'src/bare.ts', value: 5 },
            ],
          },
        ],
      }),
    );

    expect(rows).toEqual([
      { path: 'src/bare.ts', score: 5, churn: 0, complexity: 0, loc: null },
    ]);
  });
});
