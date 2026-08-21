import type { DependencyGraph, GraphEdge } from '@strata/sdk';
import { describe, expect, it } from 'vitest';
import { crossLanguageGraph } from './fold.js';

/** A graph from a compact edge list: `'a>b b>a'`, nodes inferred from it. */
function graphOf(edges: string, cycles: string[][] = []): DependencyGraph {
  const parsed: GraphEdge[] = edges
    .split(' ')
    .filter(Boolean)
    .map((edge) => {
      const [from, to] = edge.split('>');
      return { from: from!, to: to!, kind: 'import' };
    });

  const ids = new Set(parsed.flatMap((edge) => [edge.from, edge.to]));
  return {
    nodes: [...ids].sort().map((id) => ({ id, label: id, kind: 'file' })),
    edges: parsed,
    cycles,
  };
}

describe('crossLanguageGraph', () => {
  it('folds every language into one graph', () => {
    const graph = crossLanguageGraph([
      graphOf('a.ts>b.ts'),
      graphOf('a.php>b.php'),
    ]);

    expect(graph.nodes.map((node) => node.id)).toEqual([
      'a.ts',
      'b.ts',
      'a.php',
      'b.php',
    ]);
    expect(graph.edges).toHaveLength(2);
  });

  it('drops nodes, edges and cycles two plugins both claimed', () => {
    const claimed = graphOf('a.ts>b.ts b.ts>a.ts', [['a.ts', 'b.ts']]);

    const graph = crossLanguageGraph([claimed, claimed]);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
    expect(graph.cycles).toHaveLength(1);
    expect(graph.summary).toMatchObject({ nodes: 2, edges: 2, cycles: 1 });
  });

  it('gives an edge that leaves the file set a package node', () => {
    const graph = crossLanguageGraph([
      {
        nodes: [{ id: 'a.ts', label: 'a.ts', kind: 'file' }],
        edges: [{ from: 'a.ts', to: 'svelte', kind: 'import' }],
        cycles: [],
      },
    ]);

    expect(graph.nodes).toContainEqual({
      id: 'svelte',
      label: 'svelte',
      kind: 'package',
    });
  });

  it('reports each cycle as an ordered path', () => {
    const graph = crossLanguageGraph([
      graphOf('a>b b>c c>a', [['c', 'a', 'b']]),
    ]);

    expect(graph.cycles).toEqual([
      { nodes: ['a', 'b', 'c'], path: ['a', 'b', 'c', 'a'] },
    ]);
  });

  it('summarises the graph it merged, busiest node included', () => {
    const graph = crossLanguageGraph([graphOf('a>c b>c c>a c>d', [['a', 'c']])]);

    expect(graph.summary).toEqual({
      nodes: 4,
      edges: 4,
      cycles: 1,
      cycleNodes: 2,
      maxFanIn: { id: 'c', count: 2 },
      maxFanOut: { id: 'c', count: 2 },
    });
  });

  it('counts every language and keeps the busiest node of them all', () => {
    const graph = crossLanguageGraph([
      graphOf('a.ts>c.ts c.ts>a.ts', [['a.ts', 'c.ts']]),
      graphOf('a.php>c.php b.php>c.php'),
    ]);

    expect(graph.summary).toMatchObject({
      nodes: 5,
      edges: 4,
      cycles: 1,
      cycleNodes: 2,
      maxFanIn: { id: 'c.php', count: 2 },
    });
  });

  it('leaves the packages it synthesised out of the count', () => {
    // A package node is the far end of an import that left the analysed file
    // set, not a file the run looked at.
    const graph = crossLanguageGraph([
      {
        nodes: [{ id: 'a.ts', label: 'a.ts', kind: 'file' }],
        edges: [{ from: 'a.ts', to: 'svelte', kind: 'import' }],
        cycles: [],
      },
    ]);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.summary.nodes).toBe(1);
  });

  it('names nobody when nothing imports anything', () => {
    const graph = crossLanguageGraph([
      { nodes: [{ id: 'a', label: 'a', kind: 'file' }], edges: [], cycles: [] },
    ]);

    expect(graph.summary.maxFanIn).toBeNull();
    expect(graph.summary.maxFanOut).toBeNull();
  });

  it('folds no language output into an empty graph and zeroes', () => {
    expect(crossLanguageGraph([])).toEqual({
      nodes: [],
      edges: [],
      cycles: [],
      summary: {
        nodes: 0,
        edges: 0,
        cycles: 0,
        cycleNodes: 0,
        maxFanIn: null,
        maxFanOut: null,
      },
    });
  });
});
