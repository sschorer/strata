import type { GraphEdge } from '@strata/sdk';

/**
 * Which column each node belongs in.
 *
 * A dependency graph reads best when every arrow points the same way: what a
 * thing imports sits to its right, so "who depends on whom" is the direction
 * your eye already travels. That is a *layering* — each node one column past
 * the furthest thing that imports it.
 *
 * Import cycles are the awkward case, because a cycle has no left-to-right
 * order at all. The standard answer applies: find the edges that close a loop,
 * leave them out of the ranking, and draw them afterwards pointing backwards —
 * which is exactly how a cycle should look on a graph that otherwise flows one
 * way.
 */
export interface Ranking {
  /** `node id → column`, counting from 0. */
  rank: Map<string, number>;
  /** The edges left out of the ranking because they close a loop. */
  reversed: Set<string>;
}

/** Identity of an edge as this module keys it. */
const key = (edge: GraphEdge) => `${edge.from} ${edge.to}`;

export function rankNodes(
  ids: readonly string[],
  edges: readonly GraphEdge[],
): Ranking {
  const reversed = backEdges(ids, edges);
  const forward = edges.filter((edge) => !reversed.has(key(edge)));

  const incoming = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of forward) incoming.get(edge.to)?.push(edge.from);

  // Longest path from any root: a node sits one past everything that reaches
  // it, so no arrow ever points backwards except the ones we set aside.
  const rank = new Map<string, number>();
  const settling = new Set<string>();
  const rankOf = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (settling.has(id)) return 0;

    settling.add(id);
    const depth = (incoming.get(id) ?? []).reduce(
      (deepest, from) => Math.max(deepest, rankOf(from) + 1),
      0,
    );
    settling.delete(id);
    rank.set(id, depth);
    return depth;
  };

  for (const id of ids) rankOf(id);
  return { rank, reversed };
}

/**
 * The edges that close a loop, found by a depth-first walk: an edge back onto
 * a node still open in the current path is one. Nodes are walked in a stable
 * order so the same graph always sets aside the same edges.
 */
function backEdges(
  ids: readonly string[],
  edges: readonly GraphEdge[],
): Set<string> {
  const outgoing = new Map<string, GraphEdge[]>(ids.map((id) => [id, []]));
  for (const edge of edges) outgoing.get(edge.from)?.push(edge);
  for (const list of outgoing.values()) list.sort((a, b) => a.to.localeCompare(b.to));

  const open = new Set<string>();
  const done = new Set<string>();
  const back = new Set<string>();

  const walk = (id: string): void => {
    open.add(id);
    for (const edge of outgoing.get(id) ?? []) {
      if (open.has(edge.to)) back.add(key(edge));
      else if (!done.has(edge.to)) walk(edge.to);
    }
    open.delete(id);
    done.add(id);
  };

  for (const id of [...ids].sort()) if (!done.has(id)) walk(id);
  return back;
}
