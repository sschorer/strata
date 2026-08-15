/**
 * App-scoped settings — what the workbench-wide *Settings* screens edit:
 * appearance, the plugin/cache engine, the CI gates and the AI providers.
 * Stored sparsely in `settings.db` and merged with `DEFAULT_APP_SETTINGS` on
 * the way out.
 *
 * The project-scoped twin is `config/`, which is about what an analysis of one
 * repository does.
 */
export * from './types.js';
export * from './defaults.js';
export * from './patch.js';
export * from './errors.js';
export { openSettingsStore } from './open.js';
export { memorySettingsStore } from './memory.js';
