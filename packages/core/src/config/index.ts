/**
 * Project-scoped configuration — what the *Project settings* screens edit and
 * what an analysis of a project reads. Stored sparsely by the project store
 * (see `projects/`), merged with `DEFAULT_PROJECT_CONFIG` on the way out.
 */
export * from './types.js';
export * from './defaults.js';
export * from './patch.js';
export * from './errors.js';
