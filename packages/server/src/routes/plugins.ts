import type { FastifyInstance } from 'fastify';
import { userPluginsDir } from '@strata/core';
import type { RouteContext } from './context.js';

/**
 * What the server loaded at startup: every plugin's manifest tagged with where
 * it came from, the directory third-party plugins are read from, and anything
 * that was found but skipped — all three drive the plugins settings screen.
 */
export function pluginsRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.get('/plugins', async () => ({
    directory: userPluginsDir(),
    plugins: ctx.registry
      .all()
      .map((l) => ({ ...l.manifest, source: l.source })),
    failures: ctx.registry.failures(),
  }));
}
