import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context.js';

/** The manifests of every plugin the server loaded at startup. */
export function pluginsRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.get('/plugins', async () => ctx.registry.all().map((l) => l.manifest));
}
