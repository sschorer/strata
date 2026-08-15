import type { LanguageAnalysis } from '@strata/sdk';
import { describe, expect, it } from 'vitest';
import { summarised } from './summarise.js';

/** What a plugin built against an SDK without `summary` hands back. */
const older = {
  graph: {
    nodes: [
      { id: 'a.ts', label: 'a.ts', kind: 'file' as const },
      { id: 'b.ts', label: 'b.ts', kind: 'file' as const },
    ],
    edges: [{ from: 'a.ts', to: 'b.ts', kind: 'import' as const }],
    cycles: [],
  },
  deadCode: [],
  metrics: [],
} as unknown as LanguageAnalysis;

describe('summarised', () => {
  it('counts a graph whose plugin reported no summary', () => {
    expect(summarised(older).summary).toEqual({
      nodes: 2,
      edges: 1,
      cycles: 0,
      cycleNodes: 0,
      maxFanIn: { id: 'b.ts', count: 1 },
      maxFanOut: { id: 'a.ts', count: 1 },
    });
  });

  it('leaves a result that brought its own alone', () => {
    const summary = {
      nodes: 99,
      edges: 0,
      cycles: 0,
      cycleNodes: 0,
      maxFanIn: null,
      maxFanOut: null,
    };
    const analysis: LanguageAnalysis = { ...older, summary };

    // The plugin knows its own graph best — the count is not second-guessed.
    expect(summarised(analysis)).toBe(analysis);
    expect(summarised(analysis).summary.nodes).toBe(99);
  });
});
