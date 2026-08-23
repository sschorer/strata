import type { LanguageAnalysis } from './analysis.js';
import type { RepoContext } from './repo.js';

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
