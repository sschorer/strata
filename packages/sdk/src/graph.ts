/** A node in a dependency graph (a file, module, or symbol). */
export interface GraphNode {
  id: string;
  label: string;
  kind: 'file' | 'module' | 'package' | 'symbol';
  /** Free-form, plugin-specific attributes (loc, complexity, layer, …). */
  meta?: Record<string, number | string | boolean>;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: 'import' | 'inject' | 'call' | 'reference';
  /** Optional weight, e.g. number of references. */
  weight?: number;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Strongly-connected components with >1 node = import cycles. */
  cycles: string[][];
}
