import type { DependencyGraph, GraphEdge } from './graph.js';

/** One import cycle, in the shape a reader can act on. */
export interface GraphCycle {
  /** Every node of the strongly-connected component, sorted. */
  nodes: string[];
  /**
   * A closed walk through the component — `a → b → a`. Every consecutive pair
   * is a real edge, so the path reads as the import chain it is. It need not
   * reach every node of the knot; `nodes` is what the knot holds.
   */
  path: string[];
}

/**
 * A graph's strongly-connected components, ordered and closed into paths.
 *
 * Tarjan emits a component, not a route through it, so a cycle arrives as a bag
 * of files rather than as `a → b → a` — and every consumer that wants to print
 * one would otherwise arrange it itself. Ships with the SDK for the same reason
 * `summariseGraph` does: one definition of what a cycle looks like, for whoever
 * produces the graph and whoever reads it.
 *
 * Biggest first: a twelve-file knot is the one worth looking at, and a stable
 * order keeps a list numbered the same between two runs of the same analysis.
 */
export function orderedCycles(graph: DependencyGraph): GraphCycle[] {
  return [...graph.cycles]
    .map((component) => [...component].sort())
    .sort((a, b) => b.length - a.length || a[0]!.localeCompare(b[0]!))
    .map((nodes) => ({ nodes, path: cyclePath(nodes, graph.edges) }));
}

/**
 * Walk the component greedily from its first node, taking an unvisited
 * neighbour each step, then close the loop along the shortest way back. Every
 * node of a strongly-connected component is reachable from every other, so the
 * return leg always exists; it may revisit a node, which is honest — that is
 * what the imports do.
 */
function cyclePath(
  nodes: readonly string[],
  edges: readonly GraphEdge[],
): string[] {
  const inside = new Set(nodes);
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node, []);
  for (const edge of edges) {
    if (inside.has(edge.from) && inside.has(edge.to)) {
      adjacency.get(edge.from)!.push(edge.to);
    }
  }
  for (const targets of adjacency.values()) targets.sort();

  const start = nodes[0]!;
  const walk = [start];
  const visited = new Set(walk);
  for (;;) {
    const next = adjacency.get(walk.at(-1)!)?.find((id) => !visited.has(id));
    if (next === undefined) break;
    visited.add(next);
    walk.push(next);
  }

  const back = shortestWay(adjacency, walk.at(-1)!, start);
  return back.length === 0 ? walk : [...walk, ...back.slice(1)];
}

/**
 * Breadth-first way from `from` back to `to`, over at least one edge. Empty
 * when there is none, which a strongly-connected component rules out.
 */
function shortestWay(
  adjacency: ReadonlyMap<string, string[]>,
  from: string,
  to: string,
): string[] {
  const came = new Map<string, string>();
  const seen = new Set([from]);
  const queue = [from];

  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const next of adjacency.get(at) ?? []) {
      if (next === to) {
        const way = [to];
        for (let step = at; step !== from; step = came.get(step)!) {
          way.unshift(step);
        }
        way.unshift(from);
        return way;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      came.set(next, at);
      queue.push(next);
    }
  }

  return [];
}
