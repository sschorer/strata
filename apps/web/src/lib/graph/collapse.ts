import type { DependencyGraph, GraphEdge, GraphNode } from '@strata/sdk';
import { ancestorsOf } from './tree';

export interface CollapsedGraph extends DependencyGraph {
  /** `file id → the node drawn for it`: itself, or the folder that closed over it. */
  representative: Map<string, string>;
}

/**
 * Fold every closed folder into one node.
 *
 * This is what makes a repository-sized graph readable: closing `plugins`
 * turns nine plugin folders into one circle, and the picture becomes the
 * architecture rather than the file list. Closing an outer folder wins over
 * anything open inside it — a subtree folds whole, which is what a reader who
 * closed it meant.
 *
 * Edges are rewritten onto whatever now stands for their ends, imports that
 * turn out to be internal to a closed folder vanish, and the rest are merged,
 * carrying the number of imports behind them as `weight`. A folder node keeps
 * `meta.files`, so the view can size it by what it holds.
 */
export function collapseFolders(
  graph: DependencyGraph,
  collapsed: ReadonlySet<string>,
): CollapsedGraph {
  const representative = new Map<string, string>();
  const sizes = new Map<string, number>();

  for (const node of graph.nodes) {
    const folder = ancestorsOf(node.id).find((path) => collapsed.has(path));
    representative.set(node.id, folder ?? node.id);
    if (folder) sizes.set(folder, (sizes.get(folder) ?? 0) + 1);
  }

  const nodes: GraphNode[] = [];
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    const id = representative.get(node.id)!;
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push(
      id === node.id
        ? node
        : { id, label: id, kind: 'module', meta: { files: sizes.get(id)! } },
    );
  }

  const edges = new Map<string, GraphEdge>();
  for (const edge of graph.edges) {
    const from = representative.get(edge.from) ?? edge.from;
    const to = representative.get(edge.to) ?? edge.to;
    if (from === to) continue;

    const key = `${from} ${to} ${edge.kind}`;
    const merged = edges.get(key);
    if (merged) merged.weight = (merged.weight ?? 1) + (edge.weight ?? 1);
    else edges.set(key, { ...edge, from, to });
  }

  return {
    nodes,
    edges: [...edges.values()],
    cycles: graph.cycles
      .map((cycle) => [
        ...new Set(cycle.map((id) => representative.get(id) ?? id)),
      ])
      .filter((cycle) => cycle.length > 1),
    representative,
  };
}

/** `node id → cycle number` for the graph as drawn, folders included. */
export function collapsedMembership(
  membership: ReadonlyMap<string, number>,
  representative: ReadonlyMap<string, string>,
): Map<string, number> {
  const mapped = new Map<string, number>();
  for (const [id, cycle] of membership) {
    mapped.set(representative.get(id) ?? id, cycle);
  }
  return mapped;
}
