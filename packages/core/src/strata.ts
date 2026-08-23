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
import { crossLanguageGraph } from './graph/index.js';
import { consoleLogger } from './logger.js';
import { ProgressTracker, type ProgressListener } from './progress/index.js';
import type { LoadedPlugin, PluginRegistry } from './registry.js';
import {
  chosenConvention,
  claimedFiles,
  enabledPlugins,
  enabledStages,
  scopedFiles,
} from './scope/index.js';
import {
  declaredStages,
  planStages,
  runStages,
  stagesToRun,
} from './stages/index.js';
import { summarised } from './summarise.js';
import type { AnalysisReport, AnalyzeOptions, StrataOptions } from './types.js';

/**
 * The orchestrator, and — for everything that has migrated to a stage — the
 * scheduler. It builds a RepoContext, orders the stages from what their
 * manifests declared and runs them, then fans the rest of the work out to the
 * plugin kinds that are still waiting their turn to migrate. Everything a
 * plugin sees flows through here, which is also where the incremental cache
 * hooks in: each plugin gets a `cache` scoped to its own id, and a plugin whose
 * entire input is unchanged is skipped.
 *
 * Nothing about the stages is domain knowledge: what each one consumes, what it
 * produces and which files it wants are read off the manifests, so the order a
 * run takes follows from what is installed rather than from anything written
 * here ([ADR-10](../../../docs/adr/0010-open-analysis-pipeline.md)).
 *
 * It is also where a project's configuration turns into behaviour: the scope
 * narrows the file list once, before any plugin sees it, and the enabled-plugin
 * lists and the chosen commit convention decide who is called at all. A caller
 * that passes none of them gets the whole repository and every plugin, which is
 * what an unconfigured project asks for; one that names a plugin this workbench
 * has not loaded gets no run at all, because the alternative is a report that
 * looks like a clean one.
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

    // Who takes part, settled before a single thing is read. A configuration
    // that names a plugin this workbench has not loaded fails here, where the
    // failure still has a name to give — further down there is only a report
    // with a hole in it that reads like a clean result (`docs/adr/0012`).
    //
    // A setting names what it has always named, whether the plugin behind it is
    // a stage yet or not: `metrics` selects everything that produces a metric
    // series, and hotspots stays switched on across its migration.
    const languagePlugins = enabledPlugins(
      this.registry.loadedFor('language'),
      opts.languages,
      { setting: 'languages', kind: 'language' },
    );
    const metricPlugins = enabledPlugins(
      this.registry.loadedFor('git-metric'),
      opts.metrics,
      { setting: 'metrics', kind: 'git-metric' },
    );
    const convention = chosenConvention(
      this.registry.loadedByKind('commit-convention'),
      opts.convention,
      { setting: 'convention', kind: 'commit-convention' },
    );
    // Who takes part as a stage, and who is still one of the three kinds.
    const stages = declaredStages(
      enabledStages(this.registry.all(), [...languagePlugins, ...metricPlugins]),
    );
    const legacyLanguages = stillOfKind(
      this.registry.loadedByKind('language'),
      languagePlugins,
    );
    const metricRuns = stillOfKind(
      this.registry.loadedByKind('git-metric'),
      metricPlugins,
    );

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

    // A language plugin whose file types this repository does not hold is
    // skipped, so it is not a step anyone is waiting for either. That depends
    // on the repository rather than on the config, which is why it is settled
    // here and not with the rest of who takes part.
    const languageRuns = legacyLanguages
      .map((loaded) => ({
        loaded,
        matched: claimedFiles(files, loaded.plugin.extensions),
      }))
      .filter(({ matched }) => matched.length > 0);
    // The stages, ordered and filtered on the same terms and for the same
    // reason: a configuration nothing can satisfy fails here, before a stage
    // has read anything, and a stage whose filter matched nothing is not a step
    // anyone is waiting for either.
    const plan = planStages(stages, files);
    const scheduled = stagesToRun(plan);
    // Every step this run holds, counted rather than guessed: the two above,
    // each plugin and stage that takes part, the history read, the fold.
    progress.plan(
      2 + languageRuns.length + 1 + scheduled.length + metricRuns.length + 1,
    );

    // 1. Per-language static analysis, routed by file extension — across the
    // language plugins this project enabled that are still `language` plugins.
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

    progress.enter('history');
    const commitLog = await history(opts.root, {
      rev,
      maxCount: opts.historyLimit,
    });
    // 2. The scheduled pipeline. The stages run in the order their declarations
    // put them, each handed the files its filter matched and the outputs of
    // every type it consumes, keyed by whoever produced them.
    const staged = await runStages({
      plan,
      repo: ctx,
      history: commitLog,
      window: {
        root: opts.root,
        rev,
        limit: opts.historyLimit,
        commits: commitLog.length,
      },
      cache,
      progress,
    });

    // 3. Git-history metrics from the plugins that are still `git-metric`.
    const legacySeries = new Map<string, MetricSeries>();
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
        legacySeries.set(manifest.id, hit);
        continue;
      }

      const series = await plugin.compute(
        { ...ctx, cache: cache.scope(manifest.id, manifest.version) },
        commitLog,
      );
      cache.setRun(manifest.id, manifest.version, runKey, series);
      legacySeries.set(manifest.id, series);
      cache.flush();
    }
    // One list either way, in the order the workbench loaded the plugins — a
    // metric that has migrated to a stage reaches the report where it always
    // did, so the screens reading it do not know the difference yet.
    const metrics = metricPlugins.flatMap(({ manifest }) => {
      const series =
        staged.outputs.metrics[manifest.id] ?? legacySeries.get(manifest.id);
      return series ? [series] : [];
    });

    // 4. Commit-convention parsing (the project's convention, else the first
    // registered), then the aggregates over the parsed log — folded once here
    // rather than by every screen, card and gate that wants them.
    progress.enter('commits');
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
      // Folded once, here: what every consumer of the report would otherwise
      // derive from the per-language graphs for itself.
      dependencies: crossLanguageGraph(
        Object.values(languages).map((analysis) => analysis.graph),
      ),
      metrics,
      commits,
      commitAnalytics,
      // What the scheduled half of the pipeline said, keyed by manifest id —
      // beside the fields above, which the kinds that have not migrated still
      // fill in (`docs/adr/0015`).
      stages: staged.entries,
      provenance: staged.provenance,
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

/**
 * The plugins of one kind among those a setting selected — the ones that have
 * not migrated to a stage yet, and so are still run by the pipeline that owns
 * their kind.
 *
 * A setting selects by what a plugin produces, which is one list; running them
 * is two, for as long as both forms exist. Both halves keep the registry's
 * order, so nothing about a report moves as a plugin crosses over.
 */
function stillOfKind<T extends LoadedPlugin>(
  ofKind: readonly T[],
  selected: readonly LoadedPlugin[],
): T[] {
  const ids = new Set(selected.map((entry) => entry.manifest.id));
  return ofKind.filter((entry) => ids.has(entry.manifest.id));
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
