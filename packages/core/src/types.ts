import type {
  LanguageAnalysis,
  MetricSeries,
  ParsedCommit,
  StageEntry,
} from '@strata/sdk';
import type { CacheOptions, CacheStats } from './cache/index.js';
import type { CommitAnalytics } from './commits/index.js';
import type { CrossLanguageGraph } from './graph/index.js';
import type { StageProvenance } from './stages/index.js';

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
  /**
   * One entry per stage this run planned, keyed by the **manifest id** of the
   * plugin behind it — a status, and the output only when the stage succeeded.
   *
   * Keyed by id rather than by anything about the output, so two stages
   * producing the same type both fit and a consumer that means one specific
   * producer can find it. A stage that never ran is here too, saying so:
   * "found nothing" and "did not run" have to be different answers
   * ([ADR-15](../../../docs/adr/0015-partial-runs-and-per-stage-status.md)).
   *
   * The fields above are what the plugin kinds that have not migrated still
   * fill in; a stage's output reaches them as well, so nothing downstream has
   * to move before the last plugin has.
   */
  stages: Record<string, StageEntry>;
  /**
   * Every stage the run ordered, in that order, with the version of the plugin
   * behind it and how it ended.
   *
   * What makes two runs comparable: a gate that flipped is either a change in
   * the repository or a change in who measured it, and the second is not
   * knowable from the numbers alone.
   */
  provenance: StageProvenance[];
  cache: CacheReport;
}
