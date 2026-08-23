import { describe, expect, it } from 'vitest';
import { graphOf, languageOf } from '$lib/test/graph';
import { reportOf } from '$lib/test/report';
import { failedStage, okStage, skippedStage } from '$lib/test/stages';
import {
  outputOf,
  outputsProducing,
  soleOutputOf,
  stagesProducing,
} from './entries';

const series = { id: 'hotspots', label: 'Hotspots', points: [] };
const coupling = { id: 'coupling', label: 'Coupling', points: [] };

const report = reportOf({
  stages: {
    'strata-language-typescript': okStage('graph', languageOf(graphOf('a>b'))),
    'acme-language-python': failedStage('graph', 'parser exploded'),
    'strata-git-hotspots': okStage('metrics', series),
    'strata-git-coupling': okStage('metrics', coupling),
    'strata-commit-conventional': okStage('commits', []),
  },
});

describe('stagesProducing', () => {
  it('finds every stage of an output type, whatever became of it', () => {
    expect(stagesProducing(report, 'graph').map(({ id }) => id)).toEqual([
      'strata-language-typescript',
      'acme-language-python',
    ]);
  });

  it('is empty for an output type this run planned no stage for', () => {
    expect(stagesProducing(report, 'findings')).toEqual([]);
  });
});

describe('outputsProducing', () => {
  it('hands back only what the stages that succeeded produced', () => {
    expect(outputsProducing(report, 'graph').map(({ id }) => id)).toEqual([
      'strata-language-typescript',
    ]);
    expect(
      outputsProducing(report, 'metrics').map(({ output }) => output),
    ).toEqual([series, coupling]);
  });
});

describe('soleOutputOf', () => {
  it('is the one output of an exclusive group', () => {
    expect(soleOutputOf(report, 'commits')).toEqual([]);
  });

  it('is null where nothing produced one, which is not an empty one', () => {
    const unparsed = reportOf({
      stages: {
        'strata-commit-conventional': failedStage('commits', 'the log is odd'),
      },
    });

    expect(soleOutputOf(unparsed, 'commits')).toBeNull();
  });
});

describe('outputOf', () => {
  it('finds one named producer', () => {
    expect(outputOf(report, 'strata-git-hotspots', 'metrics')).toEqual(series);
  });

  it('reads nothing out of a stage that failed or never ran', () => {
    const troubled = reportOf({
      stages: {
        'strata-git-hotspots': skippedStage('metrics', 'nothing to work on'),
        'acme-language-python': failedStage('graph', 'parser exploded'),
      },
    });

    expect(outputOf(troubled, 'strata-git-hotspots', 'metrics')).toBeNull();
    expect(outputOf(troubled, 'acme-language-python', 'graph')).toBeNull();
  });

  it('answers nothing when the id produces something else entirely', () => {
    expect(outputOf(report, 'strata-git-hotspots', 'graph')).toBeNull();
    expect(outputOf(report, 'nobody-installed-this', 'metrics')).toBeNull();
  });
});
