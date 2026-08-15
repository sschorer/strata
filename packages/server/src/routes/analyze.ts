import type { FastifyInstance } from 'fastify';
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

/** Run an analysis and return the full report. */
export function analyzeRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.post<{ Body: AnalyzeBody }>('/analyze', { schema }, async (req) => {
    const { root, rev, historyLimit, cache } = req.body;
    const report = await ctx.strata.analyze({ root, rev, historyLimit, cache });

    // The switcher shows how long ago each project was analysed, so every run
    // over a registered root updates it — whoever asked for the run.
    try {
      const project = ctx.projects.findByRoot(root);
      if (project) {
        ctx.projects.recordAnalysis(project.id, {
          rev: report.rev,
          ...report.run,
        });
      }
    } catch (err) {
      // A registry that cannot be written is worth a line in the log; it is not
      // worth failing an analysis the caller already paid for.
      req.log.warn(
        `could not record the run against the project registry: ${(err as Error).message}`,
      );
    }
    return report;
  });
}
