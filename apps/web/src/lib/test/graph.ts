import type {
  DependencyGraph,
  GraphEdge,
  GraphSummary,
  LanguageAnalysis,
} from '@strata/sdk';

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

/**
 * One language's result, as a report carries it.
 *
 * Summarising is the plugin's job, so the counts here are only the graph's own
 * sizes and nobody is ranked; a test that cares about the summary passes the
 * fields it asserts on.
 */
export function languageOf(
  graph: DependencyGraph,
  summary: Partial<GraphSummary> = {},
): LanguageAnalysis {
  return {
    graph,
    deadCode: [],
    metrics: [],
    summary: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      cycles: graph.cycles.length,
      cycleNodes: new Set(graph.cycles.flat()).size,
      maxFanIn: null,
      maxFanOut: null,
      ...summary,
    },
  };
}
