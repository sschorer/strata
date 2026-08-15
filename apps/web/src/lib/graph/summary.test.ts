import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '$lib/api';
import { graphOf, languageOf } from '$lib/test/graph';
import { reportSummary } from './summary';

function reportWith(languages: AnalysisReport['languages']): AnalysisReport {
  return {
    rev: 'abc',
    run: {
      branch: 'main',
      files: 0,
      durationMs: 1,
      finishedAt: '2026-01-01T00:00:00.000Z',
    },
    languages,
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
  };
}

describe('reportSummary', () => {
  it('reads the numbers the language module reported', () => {
    const summary = reportSummary(
      reportWith({
        typescript: languageOf(graphOf('a>c b>c c>a c>d', [['a', 'c']]), {
          maxFanIn: { id: 'c', count: 2 },
          maxFanOut: { id: 'c', count: 2 },
        }),
      }),
    );

    expect(summary).toEqual({
      nodes: 4,
      edges: 4,
      cycles: 1,
      cycleNodes: 2,
      maxFanIn: { id: 'c', count: 2 },
      maxFanOut: { id: 'c', count: 2 },
    });
  });

  it('adds every language up and keeps the busiest node of them all', () => {
    const summary = reportSummary(
      reportWith({
        typescript: languageOf(graphOf('a.ts>c.ts', [['a.ts', 'c.ts']]), {
          maxFanIn: { id: 'c.ts', count: 1 },
        }),
        php: languageOf(graphOf('a.php>c.php b.php>c.php'), {
          maxFanIn: { id: 'c.php', count: 2 },
        }),
      }),
    );

    expect(summary.nodes).toBe(5);
    expect(summary.edges).toBe(3);
    expect(summary.cycles).toBe(1);
    expect(summary.cycleNodes).toBe(2);
    expect(summary.maxFanIn).toEqual({ id: 'c.php', count: 2 });
  });

  it('names nobody when nothing imports anything', () => {
    const summary = reportSummary(
      reportWith({
        typescript: languageOf({
          nodes: [{ id: 'a', label: 'a', kind: 'file' }],
          edges: [],
          cycles: [],
        }),
      }),
    );

    expect(summary.nodes).toBe(1);
    expect(summary.maxFanIn).toBeNull();
    expect(summary.maxFanOut).toBeNull();
  });

  it('summarises a report no language plugin touched as zeroes', () => {
    expect(reportSummary(reportWith({}))).toEqual({
      nodes: 0,
      edges: 0,
      cycles: 0,
      cycleNodes: 0,
      maxFanIn: null,
      maxFanOut: null,
    });
  });
});
