import type { LanguageAnalysis, MetricSeries, ParsedCommit } from '@strata/sdk';
import type { CacheOptions, CacheStats } from './cache/index.js';

export interface AnalyzeOptions {
  /** Working-tree root of the repo to analyse. */
  root: string;
  /** Revision to analyse; defaults to HEAD. */
  rev?: string;
  /** Cap the history window (number of commits). */
  historyLimit?: number;
  /** Set false to recompute everything for this run (nothing is read or written). */
  cache?: boolean;
}

export interface StrataOptions {
  /** Incremental cache configuration; `false` turns it off entirely. */
  cache?: CacheOptions | false;
}

/** What the cache did during one analysis. */
export interface CacheReport extends CacheStats {
  enabled: boolean;
  /** Database file backing the cache, if any. */
  path?: string;
}

export interface AnalysisReport {
  rev: string;
  languages: Record<string, LanguageAnalysis>;
  metrics: MetricSeries[];
  commits: ParsedCommit[];
  cache: CacheReport;
}
