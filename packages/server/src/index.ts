/**
 * @strata/server — the HTTP boundary over `@strata/core`.
 *
 * This file is a barrel; the process entry point is `main.ts`.
 */
export { createServer } from './app.js';
export { buildRegistry } from './registry.js';
export { registerRoutes, type RouteContext } from './routes/index.js';
