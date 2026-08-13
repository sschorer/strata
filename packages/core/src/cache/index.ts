/**
 * The incremental cache (ADR-4) — see `types.ts` for the shape and why there
 * are two levels. `openAnalysisCache()` is the only entry point callers need.
 */
export * from './types.js';
export * from './open.js';
export * from './null.js';
export * from './digest.js';
export * from './stats.js';
export { SqliteAnalysisCache } from './sqlite.js';
