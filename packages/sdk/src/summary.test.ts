import { describe, expect, it } from 'vitest';
import type { DependencyGraph, GraphEdge } from './graph.js';
import { summariseGraph } from './summary.js';

/** A graph from a compact edge list: `'a>c b>c'`, nodes inferred from it. */
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

describe('summariseGraph', () => {
  it('counts the graph and names its busiest node', () => {
    const summary = summariseGraph(graphOf('a>c b>c c>a c>d', [['a', 'c']]));

    expect(summary).toEqual({
      nodes: 4,
      edges: 4,
      cycles: 1,
      cycleNodes: 2,
      maxFanIn: { id: 'c', count: 2 },
      maxFanOut: { id: 'c', count: 2 },
    });
  });

  it('names nobody when nothing imports anything', () => {
    const summary = summariseGraph({
      nodes: [{ id: 'a', label: 'a', kind: 'file' }],
      edges: [],
      cycles: [],
    });

    expect(summary.nodes).toBe(1);
    expect(summary.maxFanIn).toBeNull();
    expect(summary.maxFanOut).toBeNull();
  });

  it('breaks a tie by id, so the same graph always names the same node', () => {
    const summary = summariseGraph(graphOf('x>b x>a'));

    expect(summary.maxFanIn).toEqual({ id: 'a', count: 1 });
  });

  it('counts a node once however many cycles hold it', () => {
    const summary = summariseGraph(
      graphOf('a>b b>a a>c c>a', [
        ['a', 'b'],
        ['a', 'c'],
      ]),
    );

    expect(summary.cycles).toBe(2);
    expect(summary.cycleNodes).toBe(3);
  });
});
