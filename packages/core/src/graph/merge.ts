import type { DependencyGraph, GraphEdge, GraphNode } from '@strata/sdk';

/**
 * Every language's graph, folded into one.
 *
 * Language plugins analyse disjoint file sets, so the merge is mostly a
 * concatenation — but two plugins claiming the same extension would both emit
 * the file, and a duplicate would be drawn twice and counted twice, so ids,
 * edges and components are deduplicated here.
 */
export function mergedGraph(
  graphs: readonly DependencyGraph[],
): DependencyGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const cycles = new Map<string, string[]>();

  for (const graph of graphs) {
    for (const node of graph.nodes) {
      if (!nodes.has(node.id)) nodes.set(node.id, node);
    }
    for (const edge of graph.edges) {
      const key = `${edge.from} ${edge.to} ${edge.kind}`;
      if (!edges.has(key)) edges.set(key, edge);
    }
    for (const cycle of graph.cycles) {
      // Tarjan's order through a component is an artefact of where it started,
      // so identity is the set of nodes rather than the sequence.
      const key = [...cycle].sort().join(' ');
      if (!cycles.has(key)) cycles.set(key, cycle);
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    cycles: [...cycles.values()],
  };
}
