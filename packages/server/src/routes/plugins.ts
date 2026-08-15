import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context.js';

/**
 * What the server loaded at startup: every plugin's manifest tagged with where
 * it came from, the directory third-party plugins are read from, and anything
 * that was found but skipped — all three drive the plugins settings screen.
 *
 * The directory is the one resolved at startup, when plugins load — so a
 * *Plugins directory* edited since then reads as the pending change it is,
 * rather than as where these plugins came from. It is reported whether or not
 * third-party loading is switched on, because it is where a drop-in plugin
 * goes either way; whether they were loaded is `engine.thirdPartyPlugins` on
 * `/settings`, which is the toggle the same screen renders beside the path.
 */
export function pluginsRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.get('/plugins', async () => ({
    directory: ctx.pluginsDir,
    plugins: ctx.registry
      .all()
      .map((l) => ({ ...l.manifest, source: l.source })),
    failures: ctx.registry.failures(),
  }));
}
