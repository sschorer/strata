import Fastify, { type FastifyInstance } from 'fastify';
import {
  createConsoleLogger,
  DEFAULT_APP_SETTINGS,
  openProjectStore,
  openSettingsStore,
  Strata,
  userPluginsDir,
  type EngineSettings,
  type SettingsStore,
} from '@strata/core';
import { buildRegistry } from './registry.js';
import { registerRoutes } from './routes/index.js';

/**
 * Build the HTTP app: read the app settings, discover plugins the way they say
 * to, hold one `Strata` (so the incremental cache is opened once and closed
 * with the server), one project registry and one settings store, register
 * routes.
 *
 * The settings come first because *Plugins & engine* decides what gets loaded,
 * and loading happens exactly once, here.
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const settings = openSettingsStore();
  const engine = engineSettings(settings);
  const pluginsDir = engine.pluginsDir ?? userPluginsDir();
  const registry = await buildRegistry({
    pluginsDir,
    thirdParty: engine.thirdPartyPlugins,
  });
  const strata = new Strata(registry);
  const projects = openProjectStore();

  registerRoutes(app, { strata, registry, projects, settings, pluginsDir });

  // Flush and close the cache, the registry and the settings with the server.
  app.addHook('onClose', async () => {
    strata.close();
    projects.close();
    settings.close();
  });

  return app;
}

/**
 * What *Plugins & engine* says, or the defaults. Opening the settings already
 * degrades rather than throws; reading them has to as well, because a store
 * that opened but cannot be read (a locked or corrupt file) would otherwise
 * take the whole server down over a preference.
 */
function engineSettings(settings: SettingsStore): EngineSettings {
  try {
    return settings.get().engine;
  } catch (err) {
    createConsoleLogger('strata:settings').warn(
      `starting on the default engine settings — could not read them: ${
        (err as Error).message
      }`,
    );
    return DEFAULT_APP_SETTINGS.engine;
  }
}
