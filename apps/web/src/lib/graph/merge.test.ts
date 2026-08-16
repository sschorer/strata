import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '$lib/api';
import { noCommits } from '$lib/test/commits';
import { graphOf, languageOf } from '$lib/test/graph';
import { mergedGraph } from './merge';

function reportWith(
  languages: AnalysisReport['languages'],
): AnalysisReport {
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
    commitAnalytics: noCommits(),
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

describe('mergedGraph', () => {
  it('folds every language into one graph', () => {
    const graph = mergedGraph(
      reportWith({
        typescript: languageOf({
          nodes: [{ id: 'a.ts', label: 'a.ts', kind: 'file' }],
          edges: [],
          cycles: [],
        }),
        php: languageOf({
          nodes: [{ id: 'a.php', label: 'a.php', kind: 'file' }],
          edges: [],
          cycles: [],
        }),
      }),
    );

    expect(graph.nodes.map((node) => node.id)).toEqual(['a.ts', 'a.php']);
  });

  it('drops nodes, edges and cycles two plugins both claimed', () => {
    const language = languageOf(graphOf('a.ts>b.ts', [['a.ts', 'b.ts']]));

    const graph = mergedGraph(
      reportWith({ typescript: language, other: language }),
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.cycles).toHaveLength(1);
  });

  it('gives an edge that leaves the file set a package node', () => {
    const graph = mergedGraph(
      reportWith({
        typescript: languageOf({
          nodes: [{ id: 'a.ts', label: 'a.ts', kind: 'file' }],
          edges: [{ from: 'a.ts', to: 'svelte', kind: 'import' }],
          cycles: [],
        }),
      }),
    );

    expect(graph.nodes).toContainEqual({
      id: 'svelte',
      label: 'svelte',
      kind: 'package',
    });
  });
});
