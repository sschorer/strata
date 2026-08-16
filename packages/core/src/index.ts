/**
 * @strata/core — the orchestrator: git ingest, the plugin registry, the
 * analysis pipeline and the incremental cache.
 *
 * This file is a barrel: one concern per module, re-exported here as the
 * package's public surface.
 */
export { Strata } from './strata.js';
export {
  PluginRegistry,
  type LoadedPlugin,
  type PluginLoadFailure,
  type PluginSource,
} from './registry.js';
export { discoverPlugins } from './discover.js';
export { userPluginsDir } from './plugins-dir.js';
export {
  readManifest,
  resolveEntry,
  MANIFEST_FILENAME,
} from './manifest.js';
export { createConsoleLogger, consoleLogger } from './logger.js';
export type {
  AnalysisReport,
  AnalyzeOptions,
  CacheReport,
  RunReport,
  StrataOptions,
} from './types.js';
export {
  openAnalysisCache,
  nullCache,
  type AnalysisCache,
  type CacheOptions,
  type CacheStats,
} from './cache/index.js';
export {
  analyseCommits,
  bucketBy,
  weeklyActivity,
  type CommitAnalytics,
  type CommitBucket,
  type CommitWeek,
} from './commits/index.js';
export {
  openProjectStore,
  memoryProjectStore,
  DuplicateRootError,
  type Project,
  type ProjectAnalysis,
  type ProjectInput,
  type ProjectStore,
  type ProjectStoreOptions,
  type ProjectUpdate,
} from './projects/index.js';
export {
  listDirectory,
  type BrowseOptions,
  type DirectoryEntry,
  type DirectoryListing,
} from './browse/index.js';
export {
  allowedDirectory,
  configuredRoots,
  resolveRoots,
  withinRoots,
  NoSuchDirectoryError,
  RootDeniedError,
} from './roots/index.js';
export {
  DEFAULT_PROJECT_CONFIG,
  withDefaults,
  InvalidConfigError,
  type ArchitectureRule,
  type ProjectConfig,
  type ProjectConfigPatch,
} from './config/index.js';
export {
  openSettingsStore,
  memorySettingsStore,
  DEFAULT_APP_SETTINGS,
  withAppDefaults,
  applyAppPatch,
  InvalidSettingsError,
  DENSITIES,
  THEME_MODES,
  type AIProviderInput,
  type AIProviderInstance,
  type AISettings,
  type AISettingsPatch,
  type AppearanceSettings,
  type AppSettings,
  type AppSettingsPatch,
  type Density,
  type EngineSettings,
  type GateSettings,
  type SettingsStore,
  type SettingsStoreOptions,
  type StoredAppSettings,
  type ThemeMode,
} from './settings/index.js';
export * as gitUtil from './git/index.js';
