import type {
  LanguageAnalysis,
  MetricSeries,
  ParsedCommit,
  PluginManifest,
} from '@strata/sdk';

/**
 * The shapes `@strata/server` puts on the wire. The leaf types come from
 * `@strata/sdk` — the published contract both sides already share — while the
 * envelopes below are the HTTP responses themselves, which live nowhere else.
 *
 * These are type-only imports: nothing from the SDK is bundled into the app,
 * and the UI still talks to the server over REST only.
 */

export type PluginSource = 'builtin' | 'user';

export interface HealthResponse {
  status: string;
}

export interface LoadedPluginInfo extends PluginManifest {
  source: PluginSource;
}

export interface PluginFailureInfo {
  manifestPath: string;
  source: PluginSource;
  error: string;
}

export interface PluginsResponse {
  /** Directory third-party plugins are read from (may not exist yet). */
  directory: string;
  plugins: LoadedPluginInfo[];
  failures: PluginFailureInfo[];
}

export interface CacheReport {
  enabled: boolean;
  path?: string;
  hits: number;
  misses: number;
  runHits: number;
  runMisses: number;
  writes: number;
}

export interface AnalysisReport {
  rev: string;
  languages: Record<string, LanguageAnalysis>;
  metrics: MetricSeries[];
  commits: ParsedCommit[];
  cache: CacheReport;
}

export interface AnalyzeRequest {
  /** Absolute path of the repo working tree to analyse. */
  root: string;
  rev?: string;
  historyLimit?: number;
  /** Set false to recompute everything, ignoring the incremental cache. */
  cache?: boolean;
}

export interface ClearCacheResponse {
  cleared: boolean;
}
