import { describe, expect, it } from 'vitest';
import type { MetricSeries } from '@strata/sdk';
import { languageOf } from '$lib/test/graph';
import { reportOf } from '$lib/test/report';
import { failedStage, okStage, skippedStage } from '$lib/test/stages';
import { hotspotRows, HOTSPOT_STAGE_ID } from './rows';

const hotspots: MetricSeries = {
  id: 'hotspots',
  label: 'Hotspots (churn × complexity)',
  points: [
    { subject: 'src/a.ts', value: 300, meta: { churn: 10, complexity: 30 } },
    { subject: 'src/b.ts', value: 900, meta: { churn: 9, complexity: 100 } },
  ],
};

/** A run whose hotspot stage produced `series`, and nothing else did. */
const ranked = (series: MetricSeries) =>
  reportOf({ stages: { [HOTSPOT_STAGE_ID]: okStage('metrics', series) } });

describe('hotspotRows', () => {
  it('joins the hotspot stage with the line counts of the graph stages', () => {
    const rows = hotspotRows(
      reportOf({
        stages: {
          [HOTSPOT_STAGE_ID]: okStage('metrics', hotspots),
          'strata-language-typescript': okStage('graph', {
            ...languageOf({ nodes: [], edges: [], cycles: [] }),
            metrics: [{ path: 'src/a.ts', loc: 120 }],
          }),
        },
      }),
    );

    expect(rows).toEqual([
      { path: 'src/b.ts', score: 900, churn: 9, complexity: 100, loc: null },
      { path: 'src/a.ts', score: 300, churn: 10, complexity: 30, loc: 120 },
    ]);
  });

  it('is empty when no stage produced the series', () => {
    const other = reportOf({
      stages: {
        'strata-git-coupling': okStage('metrics', {
          id: 'coupling',
          label: 'x',
          points: [],
        }),
      },
    });

    expect(hotspotRows(other)).toEqual([]);
  });

  it('reads nothing out of a stage that failed or never ran', () => {
    const failed = reportOf({
      stages: { [HOTSPOT_STAGE_ID]: failedStage('metrics', 'git log exploded') },
    });
    const skipped = reportOf({
      stages: {
        [HOTSPOT_STAGE_ID]: skippedStage(
          'metrics',
          '"strata-commit-conventional" failed',
          'strata-commit-conventional',
        ),
      },
    });

    expect(hotspotRows(failed)).toEqual([]);
    expect(hotspotRows(skipped)).toEqual([]);
  });

  it('drops unscored files and reads missing meta as zero', () => {
    const rows = hotspotRows(
      ranked({
        id: 'hotspots',
        label: 'Hotspots',
        points: [
          { subject: 'src/zero.ts', value: 0, meta: { churn: 1 } },
          { subject: 'src/bare.ts', value: 5 },
        ],
      }),
    );

    expect(rows).toEqual([
      { path: 'src/bare.ts', score: 5, churn: 0, complexity: 0, loc: null },
    ]);
  });
});
