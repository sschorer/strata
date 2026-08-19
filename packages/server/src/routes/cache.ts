import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context.js';

/**
 * Escape hatch: drop every cached result (e.g. after upgrading a plugin in
 * place without bumping its version).
 *
 * It goes through the queue like a run does, and so waits behind one that is in
 * flight: a clear landing mid-analysis would pull rows out from under a run
 * that had already counted them as hits.
 */
export function cacheRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.delete('/cache', async () => {
    await ctx.analyses.clearCache();
    return { cleared: true };
  });
}
