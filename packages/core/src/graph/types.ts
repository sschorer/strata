import type {
  GraphCycle,
  GraphEdge,
  GraphNode,
  GraphSummary,
} from '@strata/sdk';

/**
 * Every language's dependency graph, folded into the one graph a consumer
 * reads: deduplicated, with the far ends of imports that leave the analysed
 * file set named, its cycles ordered into paths, and the numbers over it.
 */
export interface CrossLanguageGraph {
  /** Every language's nodes, plus a synthesised one per package an edge names. */
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** The knots, biggest first, each closed into a walk over real edges. */
  cycles: GraphCycle[];
  /**
   * The headline numbers over the analysed nodes and edges. The synthesised
   * package nodes are not counted: nothing analysed them, so counting them
   * would inflate "how big is this repository" with its dependencies.
   */
  summary: GraphSummary;
}
