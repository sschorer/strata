import Fastify, { type FastifyInstance } from 'fastify';
import {
  AnalysisQueue,
  createConsoleLogger,
  DEFAULT_APP_SETTINGS,
  openProjectStore,
  openSettingsStore,
  userPluginsDir,
  type EngineSettings,
  type SettingsStore,
} from '@strata/core';
import { authWarning, configuredToken, requireToken } from './auth/index.js';
import { buildRegistry, type RegistryOptions } from './registry.js';
import { registerRoutes } from './routes/index.js';
import { workerRunner } from './worker/index.js';

/**
 * Build the HTTP app: read the app settings, discover plugins the way they say
 * to, put one analysis queue in front of the pipeline, hold one project
 * registry and one settings store, put the deployment's token in front of the
 * lot, register routes.
 *
 * The settings come first because *Plugins & engine* decides what gets loaded,
 * and loading happens exactly once, here.
 *
 * Nothing on this thread ever runs an analysis. The queue hands the work to a
 * worker thread, which owns the plugins it runs and the incremental cache they
 * write to — so a repository being parsed is not a repository during which this
 * server has stopped answering.
 */
export async function createServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  guardWithToken(app);
  const settings = openSettingsStore();
  const engine = engineSettings(settings);
  const pluginsDir = engine.pluginsDir ?? userPluginsDir();
  const loading: RegistryOptions = {
    pluginsDir,
    thirdParty: engine.thirdPartyPlugins,
  };
  // What `/plugins` and the settings screens read: manifests, sources and
  // whatever was skipped. The analysis thread loads the same set again for
  // itself, which is the price of the two threads sharing no state.
  const registry = await buildRegistry(loading);
  const analyses = new AnalysisQueue(workerRunner({ registry: loading }));
  const projects = openProjectStore();

  registerRoutes(app, { analyses, registry, projects, settings, pluginsDir });

  // Stop the analysis thread, then close the registry and the settings.
  app.addHook('onClose', async () => {
    await analyses.close();
    projects.close();
    settings.close();
  });

  return app;
}

/**
 * Put `$STRATA_TOKEN` in front of every route, and say at startup what that
 * leaves reachable.
 *
 * Before the routes, because a Fastify hook only runs for the routes
 * registered after it — and before the stores and the plugin scan, so the
 * order in `createServer` reads the way a request travels.
 */
function guardWithToken(app: FastifyInstance): void {
  const token = configuredToken();
  if (token !== undefined) requireToken(app, token);

  const warning = authWarning(token);
  if (warning !== undefined) {
    createConsoleLogger('strata:auth').warn(warning);
  }
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
