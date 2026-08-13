import Fastify, { type FastifyInstance } from 'fastify';
import { Strata } from '@strata/core';
import { buildRegistry } from './registry.js';
import { registerRoutes } from './routes/index.js';

/**
 * Build the HTTP app: discover plugins once, hold one `Strata` (so the
 * incremental cache is opened once and closed with the server), register routes.
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const registry = await buildRegistry();
  const strata = new Strata(registry);

  registerRoutes(app, { strata, registry });

  // Flush and close the cache with the server.
  app.addHook('onClose', async () => strata.close());

  return app;
}
