import { describe, expect, it } from 'vitest';
import type { DeadCodeFinding } from '@strata/sdk';
import { graphOf, languageOf } from '$lib/test/graph';
import { reportOf } from '$lib/test/report';
import { failedStage, okStage } from '$lib/test/stages';
import { deadCodeCount } from './dead-code';

/** A run whose graph stages found `deadCode`, keyed by manifest id. */
const report = (deadCode: Record<string, DeadCodeFinding[]>) =>
  reportOf({
    stages: Object.fromEntries(
      Object.entries(deadCode).map(([id, findings]) => [
        id,
        okStage('graph', { ...languageOf(graphOf('')), deadCode: findings }),
      ]),
    ),
  });

describe('deadCodeCount', () => {
  it('counts every stage that produced a graph', () => {
    expect(
      deadCodeCount(
        report({
          'strata-language-typescript': [
            { path: 'src/a.ts', reason: 'unreferenced-export' },
            { path: 'src/b.ts', reason: 'unreachable-file' },
          ],
          'acme-language-python': [
            { path: 'lib/c.py', reason: 'unreferenced-export' },
          ],
        }),
      ),
    ).toEqual({ findings: 3, files: 3 });
  });

  it('counts a file once however many symbols it is holding', () => {
    expect(
      deadCodeCount(
        report({
          'strata-language-typescript': [
            { path: 'src/barrel.ts', reason: 'unreferenced-export' },
            { path: 'src/barrel.ts', reason: 'unreferenced-export' },
            { path: 'src/barrel.ts', reason: 'unreferenced-export' },
          ],
        }),
      ),
    ).toEqual({ findings: 3, files: 1 });
  });

  it('is zero for a report with no graph stage', () => {
    expect(deadCodeCount(report({}))).toEqual({ findings: 0, files: 0 });
  });

  it('counts nothing out of a stage that failed', () => {
    // Zero here is not "no dead code" — the card asks `troublesProducing` what
    // became of the stage and prints that instead of this number.
    const thrown = reportOf({
      stages: {
        'strata-language-typescript': failedStage('graph', 'parser exploded'),
      },
    });

    expect(deadCodeCount(thrown)).toEqual({ findings: 0, files: 0 });
  });
});
