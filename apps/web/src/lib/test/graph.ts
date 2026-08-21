import type {
  DependencyGraph,
  GraphCycle,
  GraphEdge,
  GraphSummary,
  LanguageAnalysis,
} from '@strata/sdk';
import type { CrossLanguageGraph } from '$lib/api';

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

/**
 * The cross-language graph a report carries, as the core folded it.
 *
 * Every report has one and most fixtures are about something else — a hotspot,
 * a run summary, a recents list — so an empty fold is the default and a test
 * that cares passes only the parts it asserts on.
 */
export function dependenciesOf(
  over: Partial<CrossLanguageGraph> = {},
): CrossLanguageGraph {
  return {
    nodes: [],
    edges: [],
    cycles: [],
    ...over,
    summary: {
      nodes: 0,
      edges: 0,
      cycles: 0,
      cycleNodes: 0,
      maxFanIn: null,
      maxFanOut: null,
      ...over.summary,
    },
  };
}

/**
 * Components as the report carries them: ordered, and closed into the obvious
 * walk. The ordering is the core's, so a test of the browser states the knot
 * it means and takes the path for granted.
 */
export function cyclesOf(components: string[][]): GraphCycle[] {
  return components.map((nodes) => ({ nodes, path: [...nodes, nodes[0]!] }));
}
