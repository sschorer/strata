import { summariseGraph, type LanguageAnalysis } from '@strata/sdk';

/**
 * A language result, with its graph summary filled in if it arrived without one.
 *
 * The summary is part of the language contract, and the pipeline still cannot
 * assume it is there: a third-party plugin built against an SDK that predates
 * the field loads all the same — the manifest check compares major versions —
 * and a run it cached before it was updated outlives the update. Deriving the
 * numbers here costs one pass over a graph that is already in memory, and it
 * keeps every reader of a report free of the question.
 */
export function summarised(analysis: LanguageAnalysis): LanguageAnalysis {
  const { summary } = analysis as Partial<LanguageAnalysis>;
  return summary
    ? analysis
    : { ...analysis, summary: summariseGraph(analysis.graph) };
}
