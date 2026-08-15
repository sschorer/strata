import type { DependencyGraph } from './graph.js';

/** One node's share of the edges, as a fan-in / fan-out ranking prints it. */
export interface DegreeEntry {
  id: string;
  count: number;
}

/**
 * The numbers a UI shows above a graph: how big it is and where it knots.
 *
 * Derivable from the graph itself, and carried beside it anyway: the counts are
 * what a summary panel, an overview card or a CI gate reads, and none of them
 * should have to walk every edge of a repository-sized graph to learn them.
 */
export interface GraphSummary {
  nodes: number;
  edges: number;
  /** Strongly-connected components with more than one node. */
  cycles: number;
  /** Nodes inside at least one cycle. */
  cycleNodes: number;
  /** The most-imported node; `null` for a graph with no edges at all. */
  maxFanIn: DegreeEntry | null;
  /** The node with the most imports of its own. */
  maxFanOut: DegreeEntry | null;
}

/**
 * Summarise a dependency graph.
 *
 * Ships with the SDK so every language module reports the same numbers for the
 * same graph — a summary each plugin derived its own way would be a second,
 * quietly disagreeing definition of "how many edges".
 */
export function summariseGraph(graph: DependencyGraph): GraphSummary {
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

  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    cycles: graph.cycles.length,
    cycleNodes: new Set(graph.cycles.flat()).size,
    maxFanIn: busiest(fanIn),
    maxFanOut: busiest(fanOut),
  };
}

/**
 * The node the most edges touch, or `null` if none do.
 *
 * Ties are broken by id so re-running the same analysis never reshuffles the
 * name the panel prints.
 */
function busiest(counts: ReadonlyMap<string, number>): DegreeEntry | null {
  let top: DegreeEntry | null = null;
  for (const [id, count] of counts) {
    if (count === 0) continue;
    if (!top || count > top.count || (count === top.count && id < top.id)) {
      top = { id, count };
    }
  }
  return top;
}
