import type { DependencyGraph, GraphEdge } from '@strata/sdk';
import { degrees } from './degree';

/** The part of the graph that is actually drawn, and what it left behind. */
export interface FocusedGraph extends DependencyGraph {
  /** Nodes the full graph has that this one does not. */
  hidden: number;
}

/**
 * Pick the subgraph worth drawing.
 *
 * A repository's import graph runs to thousands of files; past a few hundred
 * circles the picture stops being readable long before it stops being fast.
 * So the canvas gets a ranked slice: every node inside a cycle first — those
 * are the finding this screen exists for — then the busiest nodes by total
 * degree, ties broken by id so the same analysis always draws the same graph.
 *
 * Edges survive when both their ends do; cycles survive whole or not at all,
 * which keeps the numbering in the side panel matching what is on screen.
 */
export function focusGraph(
  graph: DependencyGraph,
  limit: number,
): FocusedGraph {
  if (graph.nodes.length <= limit) return { ...graph, hidden: 0 };

  const { fanIn, fanOut } = degrees(graph);
  const inCycle = new Set(graph.cycles.flat());
  const total = (id: string) => (fanIn.get(id) ?? 0) + (fanOut.get(id) ?? 0);

  const kept = new Set(
    [...graph.nodes]
      .sort(
        (a, b) =>
          Number(inCycle.has(b.id)) - Number(inCycle.has(a.id)) ||
          total(b.id) - total(a.id) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, limit)
      .map((node) => node.id),
  );

  return {
    nodes: graph.nodes.filter((node) => kept.has(node.id)),
    edges: graph.edges.filter(
      (edge) => kept.has(edge.from) && kept.has(edge.to),
    ),
    cycles: graph.cycles.filter((cycle) => cycle.every((id) => kept.has(id))),
    hidden: graph.nodes.length - kept.size,
  };
}

/** A node and everything one edge away from it — what a selection lights up. */
export function neighbourhood(
  edges: readonly GraphEdge[],
  id: string,
): Set<string> {
  const around = new Set([id]);
  for (const edge of edges) {
    if (edge.from === id) around.add(edge.to);
    if (edge.to === id) around.add(edge.from);
  }
  return around;
}
