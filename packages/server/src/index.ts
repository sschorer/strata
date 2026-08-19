/**
 * @strata/server — the HTTP boundary over `@strata/core`.
 *
 * This file is a barrel; the process entry point is `main.ts`.
 */
export { createServer } from './app.js';
export { buildRegistry, type RegistryOptions } from './registry.js';
export { registerRoutes, type RouteContext } from './routes/index.js';
export { authWarning, configuredToken, requireToken } from './auth/index.js';
export {
  spawnThread,
  workerRunner,
  type AnalysisThread,
  type SpawnThread,
  type WorkerCommand,
  type WorkerEvent,
  type WorkerRunnerOptions,
} from './worker/index.js';
