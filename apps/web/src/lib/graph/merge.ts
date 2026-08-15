import type { DependencyGraph, GraphEdge, GraphNode } from '@strata/sdk';
import type { AnalysisReport } from '$lib/api';
import { edgeKey } from './edges';

/**
 * Every language's graph, folded into the one graph the screen draws.
 *
 * A report carries one `DependencyGraph` per language plugin. They analyse
 * disjoint file sets, so the merge is mostly a concatenation — but two plugins
 * claiming the same extension would both emit the file, and a duplicated node
 * would be drawn twice, so ids and edges are deduplicated here.
 *
 * An edge whose target has no node names something outside the analysed file
 * set — a package. The language contract lets a plugin emit those without also
 * emitting the node, so one is synthesised, which is what lets the view style
 * package edges apart from local ones.
 */
export function mergedGraph(report: AnalysisReport): DependencyGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const cycles = new Map<string, string[]>();

  for (const language of Object.values(report.languages)) {
    for (const node of language.graph.nodes) {
      if (!nodes.has(node.id)) nodes.set(node.id, node);
    }
    for (const edge of language.graph.edges) {
      const key = edgeKey(edge);
      if (!edges.has(key)) edges.set(key, edge);
    }
    for (const cycle of language.graph.cycles) {
      const key = [...cycle].sort().join(' ');
      if (!cycles.has(key)) cycles.set(key, cycle);
    }
  }

  for (const edge of edges.values()) {
    for (const id of [edge.from, edge.to]) {
      if (!nodes.has(id)) nodes.set(id, { id, label: id, kind: 'package' });
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    cycles: [...cycles.values()],
  };
}
