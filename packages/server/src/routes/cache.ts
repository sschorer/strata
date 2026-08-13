import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context.js';

/**
 * Escape hatch: drop every cached result (e.g. after upgrading a plugin in
 * place without bumping its version).
 */
export function cacheRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.delete('/cache', async () => {
    ctx.strata.clearCache();
    return { cleared: true };
  });
}
