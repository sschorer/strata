import type { FastifyInstance } from 'fastify';

/** Liveness probe. */
export function healthRoute(app: FastifyInstance): void {
  app.get('/health', async () => ({ status: 'ok' }));
}
