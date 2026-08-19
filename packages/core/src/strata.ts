import { isAbsolute, relative, resolve } from 'node:path';
import type { LanguageAnalysis, MetricSeries, RepoContext } from '@strata/sdk';
import {
  deltaStats,
  digest,
  filesDigest,
  nullCache,
  openAnalysisCache,
  type AnalysisCache,
} from './cache/index.js';
import { analyseCommits } from './commits/index.js';
import { branchAt, git, history, listFiles, resolveRev } from './git/index.js';
import { consoleLogger } from './logger.js';
import { ProgressTracker, type ProgressListener } from './progress/index.js';
import type { PluginRegistry } from './registry.js';
import {
  chosenConvention,
  claimedFiles,
  enabledPlugins,
  scopedFiles,
} from './scope/index.js';
import { summarised } from './summarise.js';
import type { AnalysisReport, AnalyzeOptions, StrataOptions } from './types.js';

/**
 * The orchestrator. Builds a RepoContext, then fans the work out to whichever
 * plugins are registered. Everything a plugin sees flows through here, which is
 * also where the incremental cache hooks in: each plugin gets a `cache` scoped
 * to its own id, and a plugin whose entire input is unchanged is skipped.
 *
 * It is also where a project's configuration turns into behaviour: the scope
 * narrows the file list once, before any plugin sees it, and the enabled-plugin
 * lists and the chosen commit convention decide who is called at all. A caller
 * that passes none of them gets the whole repository and every plugin, which is
 * what an unconfigured project asks for.
 *
 * A run is also watchable: hand `analyze` a listener and it reports every step
 * as it enters it. Nothing else changes — the steps are the pipeline's own, and
 * a run nobody watches pays nothing for the option.
 */
export class Strata {
  private cache?: AnalysisCache;

  constructor(
    private readonly registry: PluginRegistry,
    private readonly options: StrataOptions = {},
  ) {}

  async analyze(
    opts: AnalyzeOptions,
    onProgress?: ProgressListener,
  ): Promise<AnalysisReport> {
    // The run clock covers everything the caller waited for, cache open included.
    const startedAt = performance.now();
    const progress = new ProgressTracker(onProgress);
    const cache = opts.cache === false ? nullCache() : this.openCache();
    warnIfCacheInsideRepo(cache.path, opts.root);
    // Counters live as long as the cache does; report this run's delta.
    const before = cache.stats();
    progress.enter('resolving');
    const rev = await resolveRev(opts.root, opts.rev);
    const branch = await branchAt(opts.root, opts.rev);
    // Scope is applied to the tracked files once, here: every plugin, the
    // report's file count and every cache key below then describe the same set.
    progress.enter('scanning');
    const files = scopedFiles(await listFiles(opts.root, rev), opts);
    const ctx: Omit<RepoContext, 'cache'> = {
      root: opts.root,
      rev,
      files,
      git: (args) => git(opts.root, args),
      log: consoleLogger,
    };

    // Who actually takes part, worked out before the first one runs: a language
    // plugin whose file types this repository does not hold is skipped, so it
    // is not a step anyone is waiting for either.
    const languageRuns = enabledPlugins(
      this.registry.loadedByKind('language'),
      opts.languages,
    )
      .map((loaded) => ({
        loaded,
        matched: claimedFiles(files, loaded.plugin.extensions),
      }))
      .filter(({ matched }) => matched.length > 0);
    const metricRuns = enabledPlugins(
      this.registry.loadedByKind('git-metric'),
      opts.metrics,
    );
    // The two stages above, one per plugin, the history read, the analytics.
    progress.plan(2 + languageRuns.length + 1 + metricRuns.length + 1);

    // 1. Per-language static analysis, routed by file extension — across the
    // language plugins this project enabled.
    const languages: Record<string, LanguageAnalysis> = {};
    for (const {
      loaded: { manifest, plugin },
      matched,
    } of languageRuns) {
      progress.enter('language', manifest.id);

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
        languages[key] = summarised(hit);
        continue;
      }

      const analysis = await plugin.analyze({
        ...ctx,
        files: matched,
        cache: cache.scope(manifest.id, manifest.version),
      });
      cache.setRun(manifest.id, manifest.version, runKey, analysis);
      languages[key] = summarised(analysis);
      cache.flush();
    }

    // 2. Git-history metrics (hotspots, coupling, …).
    progress.enter('history');
    const commitLog = await history(opts.root, {
      rev,
      maxCount: opts.historyLimit,
    });
    const metrics: MetricSeries[] = [];
    for (const { manifest, plugin } of metricRuns) {
      progress.enter('metric', manifest.id);
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

    // 3. Commit-convention parsing (the project's convention, else the first
    // registered), then the aggregates over the parsed log — folded once here
    // rather than by every screen, card and gate that wants them.
    progress.enter('commits');
    const conventions = this.registry.loadedByKind('commit-convention');
    const convention = chosenConvention(conventions, opts.convention);
    if (opts.convention && !convention) {
      // Nothing parses, so the report claims nothing about conformance. Worth a
      // line: the config names a plugin this workbench no longer has.
      consoleLogger.warn(
        `commit convention "${opts.convention}" is not loaded; ` +
          'this run parses no commits.',
      );
    }
    const commits = convention ? commitLog.map((c) => convention.parse(c)) : [];
    const commitAnalytics = analyseCommits(commitLog, commits);

    cache.flush();
    progress.finish();
    return {
      rev,
      run: {
        branch,
        files: files.length,
        durationMs: Math.round(performance.now() - startedAt),
        finishedAt: new Date().toISOString(),
      },
      languages,
      metrics,
      commits,
      commitAnalytics,
      cache: {
        enabled: cache.path !== null,
        ...(cache.path ? { path: cache.path } : {}),
        ...deltaStats(before, cache.stats()),
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

/** Repos we have already warned about, so a server warns once per repo. */
const warnedRoots = new Set<string>();

/**
 * The default cache directory is relative to the working directory, so running
 * an analysis from inside the repo being analysed would write `cache.db` into
 * it. Harmless for results (analysis reads from git, not the worktree) but it
 * litters someone else's repository, so say so once.
 */
function warnIfCacheInsideRepo(cachePath: string | null, root: string): void {
  if (!cachePath) return;
  const rel = relative(resolve(root), cachePath);
  if (rel.startsWith('..') || isAbsolute(rel) || warnedRoots.has(root)) return;
  warnedRoots.add(root);
  consoleLogger.warn(
    `cache database lives inside the analysed repo (${cachePath}). ` +
      'Set STRATA_CACHE_DIR to keep it elsewhere.',
  );
}
