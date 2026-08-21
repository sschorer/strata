import { describe, expect, it } from 'vitest';
import type { DependencyGraph, GraphEdge } from './graph.js';
import { orderedCycles } from './cycle.js';

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

describe('orderedCycles', () => {
  it('closes a component into a walk of real edges', () => {
    const [cycle] = orderedCycles(graphOf('a>b b>c c>a', [['c', 'a', 'b']]));

    expect(cycle!.path).toEqual(['a', 'b', 'c', 'a']);
    expect(cycle!.nodes).toEqual(['a', 'b', 'c']);
  });

  it('walks back the long way when the greedy path dead-ends', () => {
    // b and c both come off a, but only c returns to it: the greedy walk takes
    // b first (sorted), then has to find its own way home.
    const graph = graphOf('a>b b>c c>a a>c', [['a', 'b', 'c']]);
    const [cycle] = orderedCycles(graph);

    const pairs = cycle!.path.slice(1).map((to, i) => `${cycle!.path[i]}>${to}`);
    for (const pair of pairs) {
      expect(graph.edges.map((e) => `${e.from}>${e.to}`)).toContain(pair);
    }
    expect(cycle!.path.at(0)).toBe(cycle!.path.at(-1));
  });

  it('handles a component of two files importing each other', () => {
    const [cycle] = orderedCycles(graphOf('a>b b>a', [['b', 'a']]));
    expect(cycle!.path).toEqual(['a', 'b', 'a']);
  });

  it('keeps every node of the component, walked over or not', () => {
    // The greedy walk from `a` takes `b` and comes straight back, so `c` is in
    // the knot without being on the route through it.
    const [cycle] = orderedCycles(
      graphOf('a>b b>a a>c c>a', [['a', 'b', 'c']]),
    );

    expect(cycle!.path).toEqual(['a', 'b', 'a']);
    expect(cycle!.nodes).toEqual(['a', 'b', 'c']);
  });

  it('lists the biggest knot first', () => {
    const cycles = orderedCycles(
      graphOf('a>b b>a c>d d>e e>c', [
        ['a', 'b'],
        ['c', 'd', 'e'],
      ]),
    );

    expect(cycles.map((cycle) => cycle.nodes)).toEqual([
      ['c', 'd', 'e'],
      ['a', 'b'],
    ]);
  });

  it('is empty for an acyclic graph', () => {
    expect(orderedCycles(graphOf('a>b b>c'))).toEqual([]);
  });
});
