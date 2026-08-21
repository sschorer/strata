import type { LanguageAnalysis, MetricSeries, ParsedCommit } from '@strata/sdk';
import type { CacheOptions, CacheStats } from './cache/index.js';
import type { CommitAnalytics } from './commits/index.js';
import type { CrossLanguageGraph } from './graph/index.js';

export interface AnalyzeOptions {
  /** Working-tree root of the repo to analyse. */
  root: string;
  /** Revision to analyse; defaults to HEAD. */
  rev?: string;
  /** Cap the history window (number of commits). */
  historyLimit?: number;
  /**
   * Repo-relative paths (or globs) to analyse; omitted or empty is the whole
   * repository.
   */
  paths?: readonly string[] | null;
  /** Globs excluded from it. */
  ignore?: readonly string[] | null;
  /**
   * Ids of the `language` plugins that may run; omitted or `null` is every
   * registered one. A list is an allow-list, and an empty one runs none.
   */
  languages?: readonly string[] | null;
  /** Ids of the `git-metric` plugins that may run; same rule. */
  metrics?: readonly string[] | null;
  /**
   * Id of the `commit-convention` plugin that parses the history; omitted or
   * `null` takes the first registered one.
   */
  convention?: string | null;
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
  /**
   * Files the run analysed — tracked at that revision and inside the project's
   * scope, so a repository narrowed to `src` reports what `src` holds rather
   * than what the checkout does.
   */
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
  /**
   * Every language's graph as one — merged, summarised, and with each cycle
   * ordered into a path. Folded here rather than by whoever reads the report,
   * so a screen, a CI gate and a second API client all read one answer
   * (`docs/adr/0010`).
   */
  dependencies: CrossLanguageGraph;
  metrics: MetricSeries[];
  commits: ParsedCommit[];
  /** The same window, folded: per type and scope, conformance, activity. */
  commitAnalytics: CommitAnalytics;
  cache: CacheReport;
}
