import type { DependencyGraph, GraphEdge } from '@strata/sdk';

/** One import cycle, in the shape the side panel prints it. */
export interface CycleView {
  /** 1-based; the number the list and the node badges share. */
  index: number;
  /** Every node in the strongly-connected component. */
  members: string[];
  /**
   * A closed walk through the component — `a → b → a`. Every consecutive pair
   * is a real edge, so the path can be read as the import chain it is.
   */
  path: string[];
}

/**
 * The report's strongly-connected components, ordered and closed into paths.
 *
 * The language plugins hand over each cycle as an unordered node set (Tarjan
 * emits the component, not a route through it), which reads as a bag of files
 * rather than as `a → b → a`. Ordering it needs the edges, so it happens here
 * until the language result carries the path itself.
 *
 * Biggest first: a twelve-file knot is the one worth looking at, and a stable
 * order keeps the numbering the same between two runs of the same analysis.
 */
export function cycleViews(graph: DependencyGraph): CycleView[] {
  return [...graph.cycles]
    .map((members) => [...members].sort())
    .sort((a, b) => b.length - a.length || a[0]!.localeCompare(b[0]!))
    .map((members, position) => ({
      index: position + 1,
      members,
      path: cyclePath(members, graph.edges),
    }));
}

/** `node id → cycle index`, for the highlight the canvas paints. */
export function cycleMembership(
  cycles: readonly CycleView[],
): Map<string, number> {
  const membership = new Map<string, number>();
  for (const cycle of cycles) {
    for (const member of cycle.members) membership.set(member, cycle.index);
  }
  return membership;
}

/**
 * Walk the component greedily from its first node, taking an unvisited
 * neighbour each step, then close the loop along the shortest way back. Every
 * node of a strongly-connected component is reachable from every other, so the
 * return leg always exists; it may revisit a node, which is honest — that is
 * what the imports do.
 */
function cyclePath(
  members: readonly string[],
  edges: readonly GraphEdge[],
): string[] {
  const inside = new Set(members);
  const adjacency = new Map<string, string[]>();
  for (const member of members) adjacency.set(member, []);
  for (const edge of edges) {
    if (inside.has(edge.from) && inside.has(edge.to)) {
      adjacency.get(edge.from)!.push(edge.to);
    }
  }
  for (const targets of adjacency.values()) targets.sort();

  const start = members[0]!;
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
