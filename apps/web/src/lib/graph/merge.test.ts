import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '$lib/api';
import { mergedGraph } from './merge';

function reportWith(
  languages: AnalysisReport['languages'],
): AnalysisReport {
  return {
    rev: 'abc',
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

describe('mergedGraph', () => {
  it('folds every language into one graph', () => {
    const graph = mergedGraph(
      reportWith({
        typescript: {
          graph: {
            nodes: [{ id: 'a.ts', label: 'a.ts', kind: 'file' }],
            edges: [],
            cycles: [],
          },
          deadCode: [],
          metrics: [],
        },
        php: {
          graph: {
            nodes: [{ id: 'a.php', label: 'a.php', kind: 'file' }],
            edges: [],
            cycles: [],
          },
          deadCode: [],
          metrics: [],
        },
      }),
    );

    expect(graph.nodes.map((node) => node.id)).toEqual(['a.ts', 'a.php']);
  });

  it('drops nodes, edges and cycles two plugins both claimed', () => {
    const language = {
      graph: {
        nodes: [
          { id: 'a.ts', label: 'a.ts', kind: 'file' as const },
          { id: 'b.ts', label: 'b.ts', kind: 'file' as const },
        ],
        edges: [{ from: 'a.ts', to: 'b.ts', kind: 'import' as const }],
        cycles: [['a.ts', 'b.ts']],
      },
      deadCode: [],
      metrics: [],
    };

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
        typescript: {
          graph: {
            nodes: [{ id: 'a.ts', label: 'a.ts', kind: 'file' }],
            edges: [{ from: 'a.ts', to: 'svelte', kind: 'import' }],
            cycles: [],
          },
          deadCode: [],
          metrics: [],
        },
      }),
    );

    expect(graph.nodes).toContainEqual({
      id: 'svelte',
      label: 'svelte',
      kind: 'package',
    });
  });
});
