import type { FastifyInstance } from 'fastify';
import { analyzeRoute } from './analyze.js';
import { cacheRoute } from './cache.js';
import { healthRoute } from './health.js';
import { pluginsRoute } from './plugins.js';
import { projectsRoute } from './projects.js';
import type { RouteContext } from './context.js';

export type { RouteContext } from './context.js';

/** Register every route on the app. One module per endpoint. */
export function registerRoutes(app: FastifyInstance, ctx: RouteContext): void {
  healthRoute(app);
  pluginsRoute(app, ctx);
  projectsRoute(app, ctx);
  analyzeRoute(app, ctx);
  cacheRoute(app, ctx);
}
