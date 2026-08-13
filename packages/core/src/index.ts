import { extname } from 'node:path';
import type {
  LanguageAnalysis,
  Logger,
  MetricSeries,
  ParsedCommit,
  RepoContext,
} from '@strata/sdk';
import { PluginRegistry } from './registry.js';
import { git, history, listFiles, resolveRev } from './git.js';
import {
  digest,
  filesDigest,
  nullCache,
  openAnalysisCache,
  type AnalysisCache,
  type CacheOptions,
  type CacheStats,
} from './cache.js';

export { PluginRegistry } from './registry.js';
export * as gitUtil from './git.js';
export {
  openAnalysisCache,
  nullCache,
  type AnalysisCache,
  type CacheOptions,
  type CacheStats,
} from './cache.js';

const consoleLogger: Logger = {
  debug: (m, meta) => console.debug(`[strata] ${m}`, meta ?? ''),
  info: (m, meta) => console.info(`[strata] ${m}`, meta ?? ''),
  warn: (m, meta) => console.warn(`[strata] ${m}`, meta ?? ''),
  error: (m, meta) => console.error(`[strata] ${m}`, meta ?? ''),
};

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

/**
 * The orchestrator. Builds a RepoContext, then fans the work out to whichever
 * plugins are registered. Everything a plugin sees flows through here, which is
 * also where the incremental cache hooks in: each plugin gets a `cache` scoped
 * to its own id, and a plugin whose entire input is unchanged is skipped.
 */
export class Strata {
  private cache?: AnalysisCache;

  constructor(
    private readonly registry: PluginRegistry,
    private readonly options: StrataOptions = {},
  ) {}

  async analyze(opts: AnalyzeOptions): Promise<AnalysisReport> {
    const cache = opts.cache === false ? nullCache() : this.openCache();
    // Counters live as long as the cache does; report this run's delta.
    const before = cache.stats();
    const rev = await resolveRev(opts.root, opts.rev);
    const files = await listFiles(opts.root, rev);
    const ctx: Omit<RepoContext, 'cache'> = {
      root: opts.root,
      rev,
      files,
      git: (args) => git(opts.root, args),
      log: consoleLogger,
    };

    // 1. Per-language static analysis, routed by file extension.
    const languages: Record<string, LanguageAnalysis> = {};
    for (const { manifest, plugin } of this.registry.loadedByKind('language')) {
      const exts = new Set(plugin.extensions.map((e) => `.${e}`));
      const matched = files.filter((f) => exts.has(extname(f.path)));
      if (matched.length === 0) continue;

      // The result depends on nothing but the matched files' contents, so their
      // digest is the whole cache key.
      const runKey = digest(['language', filesDigest(matched)]);
      const key = plugin.extensions.join(',');
      const hit = cache.getRun<LanguageAnalysis>(
        manifest.id,
        manifest.version,
        runKey,
      );
      if (hit) {
        languages[key] = hit;
        continue;
      }

      const analysis = await plugin.analyze({
        ...ctx,
        files: matched,
        cache: cache.scope(manifest.id, manifest.version),
      });
      cache.setRun(manifest.id, manifest.version, runKey, analysis);
      languages[key] = analysis;
      cache.flush();
    }

    // 2. Git-history metrics (hotspots, coupling, …).
    const commitLog = await history(opts.root, {
      rev,
      maxCount: opts.historyLimit,
    });
    const metrics: MetricSeries[] = [];
    for (const { manifest, plugin } of this.registry.loadedByKind(
      'git-metric',
    )) {
      // Metrics read history as well as files, and a shallow clone can hold a
      // different history for the same sha — so the repo goes into the key too.
      const runKey = digest([
        'git-metric',
        opts.root,
        rev,
        opts.historyLimit,
        commitLog.length,
        filesDigest(files),
      ]);
      const hit = cache.getRun<MetricSeries>(
        manifest.id,
        manifest.version,
        runKey,
      );
      if (hit) {
        metrics.push(hit);
        continue;
      }

      const series = await plugin.compute(
        { ...ctx, cache: cache.scope(manifest.id, manifest.version) },
        commitLog,
      );
      cache.setRun(manifest.id, manifest.version, runKey, series);
      metrics.push(series);
      cache.flush();
    }

    // 3. Commit-convention parsing (first registered convention wins).
    const [convention] = this.registry.byKind('commit-convention');
    const commits = convention
      ? commitLog.map((c) => convention.parse(c))
      : [];

    cache.flush();
    return {
      rev,
      languages,
      metrics,
      commits,
      cache: {
        enabled: cache.path !== null,
        ...(cache.path ? { path: cache.path } : {}),
        ...sinceStats(before, cache.stats()),
      },
    };
  }

  /** Forget every cached result. */
  clearCache(): void {
    this.openCache().clear();
  }

  /** Flush and close the cache. Call on shutdown. */
  close(): void {
    this.cache?.close();
    this.cache = undefined;
  }

  private openCache(): AnalysisCache {
    if (this.options.cache === false) return (this.cache ??= nullCache());
    return (this.cache ??= openAnalysisCache(this.options.cache));
  }
}

/** What one analysis did, derived from the cache's cumulative counters. */
function sinceStats(before: CacheStats, after: CacheStats): CacheStats {
  return {
    hits: after.hits - before.hits,
    misses: after.misses - before.misses,
    runHits: after.runHits - before.runHits,
    runMisses: after.runMisses - before.runMisses,
    writes: after.writes - before.writes,
  };
}
