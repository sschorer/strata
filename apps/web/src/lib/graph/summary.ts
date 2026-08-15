import type { DependencyGraph } from '@strata/sdk';
import { degrees, ranking, type DegreeEntry } from './degree';

/** The numbers above the canvas: how big the graph is and where it knots. */
export interface GraphSummary {
  nodes: number;
  edges: number;
  cycles: number;
  /** Nodes inside at least one cycle. */
  cycleNodes: number;
  /** The most-imported node, `null` for a graph with no edges at all. */
  maxFanIn: DegreeEntry | null;
  /** The node with the most imports of its own. */
  maxFanOut: DegreeEntry | null;
}

/**
 * Summarise the merged graph.
 *
 * Computed here rather than read off the report: the language result carries
 * no summary yet. When it does, this is the shape to fill from it — the view
 * reads nothing else.
 */
export function graphSummary(graph: DependencyGraph): GraphSummary {
  const { fanIn, fanOut } = degrees(graph);
  const [topIn] = ranking(fanIn, 1);
  const [topOut] = ranking(fanOut, 1);

  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    cycles: graph.cycles.length,
    cycleNodes: new Set(graph.cycles.flat()).size,
    maxFanIn: topIn && topIn.count > 0 ? topIn : null,
    maxFanOut: topOut && topOut.count > 0 ? topOut : null,
  };
}
