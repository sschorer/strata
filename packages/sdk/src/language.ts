import type { DependencyGraph } from './graph.js';
import type { RepoContext } from './repo.js';
import type { GraphSummary } from './summary.js';

export interface DeadCodeFinding {
  path: string;
  symbol?: string;
  line?: number;
  reason: 'unreferenced-export' | 'unreachable-file' | 'unused-dependency';
}

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

export interface LanguagePlugin {
  kind: 'language';
  /** File extensions this plugin claims, without the dot: ["ts", "tsx"]. */
  extensions: string[];
  /**
   * Analyse the subset of `ctx.files` matching `extensions`.
   * Implementations should be incremental-friendly: pure in (files) → out.
   */
  analyze(ctx: RepoContext): Promise<LanguageAnalysis>;
}

export function defineLanguagePlugin(
  p: Omit<LanguagePlugin, 'kind'>,
): LanguagePlugin {
  return { kind: 'language', ...p };
}
