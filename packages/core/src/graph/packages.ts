import type { DependencyGraph, GraphNode } from '@strata/sdk';

/**
 * A node for every end of an edge that no language emitted.
 *
 * An edge whose target has no node names something outside the analysed file
 * set — a package. The language contract lets a plugin report those without
 * also emitting the node, so one is synthesised here, which is what lets a
 * reader tell a dependency apart from a file of their own.
 */
export function packageNodes(
  graph: Pick<DependencyGraph, 'nodes' | 'edges'>,
): GraphNode[] {
  const known = new Set(graph.nodes.map((node) => node.id));
  const synthesised: GraphNode[] = [];

  for (const edge of graph.edges) {
    for (const id of [edge.from, edge.to]) {
      if (known.has(id)) continue;
      known.add(id);
      synthesised.push({ id, label: id, kind: 'package' });
    }
  }

  return synthesised;
}
