import type { Logger, PluginCache } from '@strata/sdk';

export interface CacheStats {
  /** Per-file lookups that were served from the cache. */
  hits: number;
  /** Per-file lookups that had to be computed. */
  misses: number;
  /** Whole plugin runs served from the cache (plugin never ran). */
  runHits: number;
  runMisses: number;
  /** Entries written back on this run. */
  writes: number;
}

export interface CacheOptions {
  /**
   * Off switch. Defaults to the `STRATA_CACHE` env var (`0`/`off`/`false`/`no`
   * disable it), otherwise on.
   */
  enabled?: boolean;
  /** Database file. Overrides `dir`. */
  path?: string;
  /**
   * Directory to hold `cache.db`. Defaults to `$STRATA_CACHE_DIR`, else
   * `<cwd>/.strata`. Never the analysed repo — those are mounted read-only.
   */
  dir?: string;
  /** Drop entries untouched for this long, on open. 0 disables pruning. */
  maxAgeDays?: number;
  /** Where to report a cache that could not be opened. */
  log?: Logger;
}

/**
 * The incremental cache (ADR-4). Two levels:
 *
 *   - **file** — `(pluginId, blob) → JSON`. A git blob sha *is* a content hash,
 *     so an entry stays valid for as long as the file does, across revisions,
 *     branches and repositories. Plugins reach this through `RepoContext.cache`.
 *   - **run** — `(pluginId, runKey) → JSON`. A whole plugin result, keyed on a
 *     digest of everything that went into it. When nothing changed at all, the
 *     plugin is skipped entirely rather than re-assembling a graph from cached
 *     per-file parts.
 *
 * The plugin's version is part of both keys, so publishing a new plugin build
 * invalidates exactly that plugin's entries.
 */
export interface AnalysisCache {
  /** The database file backing this cache, or `null` when disabled. */
  readonly path: string | null;
  /** A `PluginCache` bound to one plugin — what `RepoContext.cache` gets. */
  scope(pluginId: string, version: string): PluginCache;
  /** Whole-run result lookup; `undefined` on a miss. */
  getRun<T>(pluginId: string, version: string, runKey: string): T | undefined;
  setRun(
    pluginId: string,
    version: string,
    runKey: string,
    value: unknown,
  ): void;
  /** Commit everything buffered since the last flush. */
  flush(): void;
  /** Drop entries that have not been used for `maxAgeMs`. */
  prune(maxAgeMs: number): void;
  stats(): CacheStats;
  /** Forget everything (keeps the file). */
  clear(): void;
  close(): void;
}
