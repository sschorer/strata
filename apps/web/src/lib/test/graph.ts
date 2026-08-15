import type { DependencyGraph, GraphEdge } from '@strata/sdk';

/**
 * Build a dependency graph from a compact edge list: `'a>b b>c c>a'`. Nodes are
 * whatever the edges mention, so a test states the shape it means and nothing
 * else. Cycles are passed separately — the plugins compute them, the UI is only
 * ever handed the result.
 */
export function graphOf(
  edges: string,
  cycles: string[][] = [],
): DependencyGraph {
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
