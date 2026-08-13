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
    return ctx.strata.analyze({ root, rev, historyLimit, cache });
  });
}
