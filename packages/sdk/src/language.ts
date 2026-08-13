import type { DependencyGraph } from './graph.js';
import type { RepoContext } from './repo.js';

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
  /** 0–1 fraction of lines duplicated elsewhere, if computed. */
  duplication?: number;
}

export interface LanguageAnalysis {
  graph: DependencyGraph;
  deadCode: DeadCodeFinding[];
  metrics: CodeMetric[];
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
