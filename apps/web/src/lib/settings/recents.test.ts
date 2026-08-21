import { describe, expect, it } from 'vitest';
import type { AnalysisReport, ProjectAnalysis } from '$lib/api';
import { noCommits } from '$lib/test/commits';
import { dependenciesOf } from '$lib/test/graph';
import { mergeRun, RECENT_LIMIT, runEntry } from './recents';

function run(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    rev: '7f80d51cafe',
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: '2026-08-16T09:00:00.000Z',
    ...overrides,
  };
}

describe('runEntry', () => {
  it('is the summary the registry keeps, taken from a report', () => {
    const report = {
      rev: '7f80d51cafe',
      run: {
        branch: 'main',
        files: 1240,
        durationMs: 2440,
        finishedAt: '2026-08-16T09:00:00.000Z',
      },
      languages: {},
      dependencies: dependenciesOf(),
      metrics: [],
      commits: [],
      commitAnalytics: noCommits(),
      cache: {
        enabled: true,
        hits: 0,
        misses: 0,
        runHits: 0,
        runMisses: 0,
        writes: 0,
      },
    } satisfies AnalysisReport;

    expect(runEntry(report)).toEqual(run());
  });
});

describe('mergeRun', () => {
  it('puts the newest run first, whichever order they arrive in', () => {
    const older = run({ finishedAt: '2026-08-16T08:00:00.000Z' });
    const newer = run({ finishedAt: '2026-08-16T10:00:00.000Z' });

    const runs = mergeRun(mergeRun([], newer), older);

    expect(runs.map((entry) => entry.finishedAt)).toEqual([
      '2026-08-16T10:00:00.000Z',
      '2026-08-16T08:00:00.000Z',
    ]);
  });

  it('hands the same list back for a run it already holds', () => {
    const runs = mergeRun([], run());

    // Identity, not equality: it is what lets a caller skip the write.
    expect(mergeRun(runs, run({ files: 9 }))).toBe(runs);
  });

  it('keeps only the last few runs', () => {
    let runs: readonly ProjectAnalysis[] = [];
    for (let i = 0; i < RECENT_LIMIT + 3; i++) {
      const hour = String(i).padStart(2, '0');
      const finishedAt = `2026-08-16T${hour}:00:00.000Z`;
      runs = mergeRun(runs, run({ finishedAt }));
    }

    expect(runs).toHaveLength(RECENT_LIMIT);
    expect(runs[0]?.finishedAt).toBe('2026-08-16T10:00:00.000Z');
  });

  it('sorts a timestamp it cannot read to the end', () => {
    const runs = mergeRun(mergeRun([], run({ finishedAt: 'whenever' })), run());

    expect(runs.map((entry) => entry.finishedAt)).toEqual([
      '2026-08-16T09:00:00.000Z',
      'whenever',
    ]);
  });

  it('never rewrites the list it was given', () => {
    const runs = [run()];

    mergeRun(runs, run({ finishedAt: '2026-08-16T10:00:00.000Z' }));

    expect(runs).toHaveLength(1);
  });
});
