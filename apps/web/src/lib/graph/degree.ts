import type { DependencyGraph } from '@strata/sdk';

export interface Degrees {
  /** How many nodes import this one. */
  fanIn: Map<string, number>;
  /** How many nodes this one imports. */
  fanOut: Map<string, number>;
}

/**
 * Fan-in and fan-out per node.
 *
 * Both maps hold an entry for every node, zero included: the view sizes a
 * circle by degree and would otherwise have to special-case the leaves.
 */
export function degrees(
  graph: Pick<DependencyGraph, 'nodes' | 'edges'>,
): Degrees {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const node of graph.nodes) {
    fanIn.set(node.id, 0);
    fanOut.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);
    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
  }

  return { fanIn, fanOut };
}
