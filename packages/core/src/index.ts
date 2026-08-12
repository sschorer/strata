import { extname } from 'node:path';
import type {
  LanguageAnalysis,
  Logger,
  MetricSeries,
  ParsedCommit,
  RepoContext,
} from '@strata/sdk';
import { PluginRegistry } from './registry.js';
import { churn, git, history, listFiles, resolveRev } from './git.js';

export { PluginRegistry } from './registry.js';
export * as gitUtil from './git.js';

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
}

export interface AnalysisReport {
  rev: string;
  languages: Record<string, LanguageAnalysis>;
  metrics: MetricSeries[];
  commits: ParsedCommit[];
}

/**
 * The orchestrator. Builds a RepoContext, then fans the work out to whichever
 * plugins are registered. Everything a plugin sees flows through here, so this
 * is also where caching / incremental analysis will hook in.
 */
export class Strata {
  constructor(private readonly registry: PluginRegistry) {}

  async analyze(opts: AnalyzeOptions): Promise<AnalysisReport> {
    const rev = await resolveRev(opts.root, opts.rev);
    const files = await listFiles(opts.root, rev);
    const ctx: RepoContext = {
      root: opts.root,
      rev,
      files,
      git: (args) => git(opts.root, args),
      log: consoleLogger,
    };

    // 1. Per-language static analysis, routed by file extension.
    const languages: Record<string, LanguageAnalysis> = {};
    for (const lang of this.registry.byKind('language')) {
      const exts = new Set(lang.extensions.map((e) => `.${e}`));
      const matched = files.filter((f) => exts.has(extname(f.path)));
      if (matched.length === 0) continue;
      languages[lang.extensions.join(',')] = await lang.analyze({
        ...ctx,
        files: matched,
      });
    }

    // 2. Git-history metrics (hotspots, coupling, …).
    const commitLog = await history(opts.root, {
      rev,
      maxCount: opts.historyLimit,
    });
    // Warm the churn cache once; metric plugins can re-derive as needed.
    void churn(opts.root, { rev, maxCount: opts.historyLimit });
    const metrics: MetricSeries[] = [];
    for (const metric of this.registry.byKind('git-metric')) {
      metrics.push(await metric.compute(ctx, commitLog));
    }

    // 3. Commit-convention parsing (first registered convention wins).
    const [convention] = this.registry.byKind('commit-convention');
    const commits = convention
      ? commitLog.map((c) => convention.parse(c))
      : [];

    return { rev, languages, metrics, commits };
  }
}
