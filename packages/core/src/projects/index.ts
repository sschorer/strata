/**
 * The project registry — which repositories this workbench knows about, and
 * what the last analysis of each one found. See `types.ts` for the shape;
 * `openProjectStore()` is the only entry point callers need.
 */
export * from './types.js';
export * from './open.js';
export * from './memory.js';
export * from './errors.js';
export { projectId } from './id.js';
export { SqliteProjectStore } from './sqlite.js';
