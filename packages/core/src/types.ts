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

/**
 * What one run did, rather than what it found — the header line
 * (`main · @ 4c1249e · analyzed 2 min ago · 1.82s`) and the overview stat cards
 * read this. The resolved sha is `AnalysisReport.rev`, not repeated here.
 */
export interface RunReport {
  /** Branch the analysed revision names; null for a detached HEAD, sha or tag. */
  branch: string | null;
  /** Tracked files at that revision. */
  files: number;
  /** Wall-clock time of the whole run, in milliseconds. */
  durationMs: number;
  /** When the run finished, ISO 8601. */
  finishedAt: string;
}

export interface AnalysisReport {
  rev: string;
  run: RunReport;
  languages: Record<string, LanguageAnalysis>;
  metrics: MetricSeries[];
  commits: ParsedCommit[];
  cache: CacheReport;
}
