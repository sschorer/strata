import type { DependencyGraph, GraphEdge } from '@strata/sdk';

/**
 * The three ways an import reads on the canvas:
 *
 * - `local` — one analysed file importing another.
 * - `package` — an import that leaves the analysed file set (a dependency).
 * - `cycle` — both ends sit in the same strongly-connected component, so this
 *   edge is part of a knot. Drawn last and loudest; it is the finding.
 */
export type EdgeClass = 'local' | 'package' | 'cycle';

/** Identity of an edge: the pair it connects, in the way it connects it. */
export function edgeKey(edge: GraphEdge): string {
  return `${edge.from} ${edge.to} ${edge.kind}`;
}

/**
 * Classify every edge once, keyed by `edgeKey`, so the view looks a class up
 * instead of re-deriving it per frame.
 */
export function classifyEdges(
  graph: Pick<DependencyGraph, 'nodes' | 'edges'>,
  cycleOf: ReadonlyMap<string, number>,
): Map<string, EdgeClass> {
  const packages = new Set(
    graph.nodes.filter((n) => n.kind === 'package').map((n) => n.id),
  );

  const classes = new Map<string, EdgeClass>();
  for (const edge of graph.edges) {
    const cycle = cycleOf.get(edge.from);
    classes.set(
      edgeKey(edge),
      cycle !== undefined && cycle === cycleOf.get(edge.to)
        ? 'cycle'
        : packages.has(edge.to) || packages.has(edge.from)
          ? 'package'
          : 'local',
    );
  }
  return classes;
}

/** Stroke colour per class — palette tokens, so both themes are covered. */
export function edgeStroke(edgeClass: EdgeClass): string {
  if (edgeClass === 'cycle') return 'var(--strata-danger)';
  if (edgeClass === 'package') return 'var(--strata-subtle)';
  return 'var(--strata-line-strong)';
}

/** Dash pattern per class: a package edge is dashed, the other two are solid. */
export function edgeDash(edgeClass: EdgeClass): string {
  return edgeClass === 'package' ? '4 4' : 'none';
}

/** Stroke width per class; the cycle edges have to win against the mesh. */
export function edgeWidth(edgeClass: EdgeClass): number {
  return edgeClass === 'cycle' ? 1.8 : 1;
}
