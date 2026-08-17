import type { FastifyInstance } from 'fastify';
import type { Project, ProjectConfig } from '@strata/core';
import { requireAllowedRoot } from './allowed-root.js';
import type { RouteContext } from './context.js';

interface AnalyzeBody {
  root: string;
  rev?: string;
  historyLimit?: number;
  /** Set false to recompute everything, ignoring the incremental cache. */
  cache?: boolean;
}

// The schema rejects wrong types outright — `"cache": "false"` would otherwise
// be a truthy string and silently leave the cache on.
const schema = {
  body: {
    type: 'object',
    required: ['root'],
    additionalProperties: false,
    properties: {
      root: { type: 'string', minLength: 1 },
      rev: { type: 'string' },
      historyLimit: { type: 'integer', minimum: 1 },
      cache: { type: 'boolean' },
    },
  },
};

/**
 * Run an analysis and return the full report.
 *
 * The `root` is confined to `$STRATA_ROOTS` first — 403 outside them — because
 * everything below this line reads a repository, and a caller who got this far
 * is a trusted one rather than an unconfined one. The resolved path is what
 * gets analysed and what the registry is looked up by, so a symlink cannot
 * point the run somewhere else after the check.
 */
export function analyzeRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.post<{ Body: AnalyzeBody }>('/analyze', { schema }, async (req) => {
    const { rev, historyLimit, cache } = req.body;
    const root = await requireAllowedRoot(req.body.root);

    // A registered project's settings are the defaults for a run over it, so
    // clicking *Re-analyze* honours what *Project settings* says. What the
    // request states wins: a CI job asking for a specific revision means it.
    //
    // Scope, the enabled-plugin lists and the convention have no request field
    // to override them — they describe the project rather than one run, and a
    // caller that wants a different scope is describing a different project.
    const { project, config } = registered(ctx, root, req.log);
    const report = await ctx.strata.analyze({
      root,
      rev: rev ?? config?.rev,
      historyLimit: historyLimit ?? config?.historyLimit ?? undefined,
      paths: config?.paths,
      ignore: config?.ignore,
      languages: config?.languages,
      metrics: config?.metrics,
      convention: config?.convention,
      // The incremental cache is app-scoped, not per project: it is keyed on
      // blob shas and shared across every repository this workbench analyses.
      cache: cache ?? cacheEnabled(ctx, req.log),
    });

    // The switcher shows how long ago each project was analysed, so every run
    // over a registered root updates it — whoever asked for the run.
    if (project) {
      try {
        ctx.projects.recordAnalysis(project.id, {
          rev: report.rev,
          ...report.run,
        });
      } catch (err) {
        // A registry that cannot be written is worth a line in the log; it is
        // not worth failing an analysis the caller already paid for.
        req.log.warn(
          `could not record the run against the project registry: ${(err as Error).message}`,
        );
      }
    }
    return report;
  });
}

/**
 * Whether *Settings → Plugins & engine* leaves the incremental cache on;
 * `undefined` leaves the core its own default. Settings that cannot be read
 * cost the run a preference, never the run itself.
 */
function cacheEnabled(
  ctx: RouteContext,
  log: { warn(message: string): void },
): boolean | undefined {
  try {
    return ctx.settings.get().engine.cache;
  } catch (err) {
    log.warn(`could not read the app settings: ${(err as Error).message}`);
    return undefined;
  }
}

/**
 * The project registered for this root and its settings, if there is one. A
 * registry that cannot be read costs the run its defaults and its summary —
 * never the run itself.
 */
function registered(
  ctx: RouteContext,
  root: string,
  log: { warn(message: string): void },
): { project?: Project; config?: ProjectConfig } {
  try {
    const project = ctx.projects.findByRoot(root);
    if (!project) return {};
    return { project, config: ctx.projects.config(project.id) };
  } catch (err) {
    log.warn(`could not read the project registry: ${(err as Error).message}`);
    return {};
  }
}
