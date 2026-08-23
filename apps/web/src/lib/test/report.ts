import type { AnalysisReport } from '$lib/api';
import { dependenciesOf } from './graph';

/**
 * A report of a run in which nothing happened: no stage, no graph, no cycles.
 *
 * Every screen reads one, and most fixtures are about one corner of it — a
 * hotspot ranking, a run summary, a stage that failed — so the empty run is
 * written once here and a test states only the part it means.
 */
export function reportOf(over: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    rev: 'abc123',
    run: {
      status: 'ok',
      branch: 'main',
      files: 0,
      durationMs: 1,
      finishedAt: '2026-01-01T00:00:00.000Z',
    },
    dependencies: dependenciesOf(),
    stages: {},
    cache: {
      enabled: false,
      hits: 0,
      misses: 0,
      runHits: 0,
      runMisses: 0,
      writes: 0,
    },
    ...over,
  };
}
