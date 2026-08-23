import type { DependencyGraph } from './graph.js';
import type { GraphSummary } from './summary.js';

/** Something nothing reaches any more, and why nobody can. */
export interface DeadCodeFinding {
  path: string;
  symbol?: string;
  line?: number;
  reason: 'unreferenced-export' | 'unreachable-file' | 'unused-dependency';
}

/** What one file costs to read, measured over its syntax tree. */
export interface CodeMetric {
  path: string;
  loc: number;
  /** Cyclomatic complexity if the plugin computes it. */
  complexity?: number;
  /** Deepest nesting of control-flow blocks, if computed. */
  nesting?: number;
  /** 0–1 fraction of lines duplicated elsewhere, if computed. */
  duplication?: number;
}

/**
 * What a stage producing a **graph** hands over: the dependency graph it built,
 * the headline numbers over it, and what it learned about the files behind it
 * while it was building — what nothing reaches, and what each file costs.
 *
 * All four are one output rather than three, because they are one pass over one
 * file set: a module resolves every specifier to decide what imports what, and
 * the same resolution is what says which export nobody asks for. Splitting them
 * across stages would mean parsing the repository twice and keying two caches on
 * the same files, so a stage entry carries the whole of what its stage knows
 * ([ADR-10](../../../docs/adr/0010-open-analysis-pipeline.md)).
 *
 * A consumer that means the graph reads `.graph` and never learns the rest is
 * there — which is what lets a rule engine consume `graph` from a language
 * module written years later.
 */
export interface LanguageAnalysis {
  graph: DependencyGraph;
  deadCode: DeadCodeFinding[];
  metrics: CodeMetric[];
  /**
   * The graph's headline numbers. `summariseGraph(graph)` computes it; a plugin
   * that keeps richer knowledge of its own graph may fill it in itself.
   */
  summary: GraphSummary;
}
