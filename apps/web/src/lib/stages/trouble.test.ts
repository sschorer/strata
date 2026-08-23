import { describe, expect, it } from 'vitest';
import { graphOf, languageOf } from '$lib/test/graph';
import { reportOf } from '$lib/test/report';
import { failedStage, okStage, skippedStage } from '$lib/test/stages';
import { troubleOf, troublesProducing } from './trouble';

const report = reportOf({
  stages: {
    'strata-language-typescript': okStage('graph', languageOf(graphOf('a>b'))),
    'acme-language-python': failedStage('graph', 'parser exploded'),
    'acme-language-go': skippedStage(
      'graph',
      'its filter matched no file at this revision',
    ),
    'strata-git-hotspots': skippedStage(
      'metrics',
      '"strata-commit-conventional" failed, and this stage consumes what it produces',
      'strata-commit-conventional',
    ),
  },
});

describe('troublesProducing', () => {
  it('is every stage of the type with nothing to show, and why', () => {
    expect(troublesProducing(report, 'graph')).toEqual([
      {
        id: 'acme-language-python',
        status: 'failed',
        reason: 'parser exploded',
      },
      {
        id: 'acme-language-go',
        status: 'skipped',
        reason: 'its filter matched no file at this revision',
      },
    ]);
  });

  it('names the stage that took a blocked one out of the run', () => {
    // The one somebody has to fix, rather than whichever link of the chain sits
    // between them — and what tells this apart from having nothing to work on.
    expect(troublesProducing(report, 'metrics')).toEqual([
      {
        id: 'strata-git-hotspots',
        status: 'skipped',
        reason:
          '"strata-commit-conventional" failed, and this stage consumes what it produces',
        blockedBy: 'strata-commit-conventional',
      },
    ]);
  });

  it('has nothing to report about a run in which everything worked', () => {
    const clean = reportOf({
      stages: {
        'strata-language-typescript': okStage('graph', languageOf(graphOf(''))),
      },
    });

    expect(troublesProducing(clean, 'graph')).toEqual([]);
  });
});

describe('troubleOf', () => {
  it('is what became of one named stage', () => {
    expect(troubleOf(report, 'acme-language-python')).toMatchObject({
      status: 'failed',
      reason: 'parser exploded',
    });
  });

  it('is null both for a stage that succeeded and one nobody planned', () => {
    expect(troubleOf(report, 'strata-language-typescript')).toBeNull();
    expect(troubleOf(report, 'nobody-installed-this')).toBeNull();
  });
});
