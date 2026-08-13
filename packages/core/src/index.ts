/**
 * @strata/core — the orchestrator: git ingest, the plugin registry, the
 * analysis pipeline and the incremental cache.
 *
 * This file is a barrel: one concern per module, re-exported here as the
 * package's public surface.
 */
export { Strata } from './strata.js';
export { PluginRegistry, type LoadedPlugin } from './registry.js';
export { createConsoleLogger, consoleLogger } from './logger.js';
export type {
  AnalysisReport,
  AnalyzeOptions,
  CacheReport,
  StrataOptions,
} from './types.js';
export {
  openAnalysisCache,
  nullCache,
  type AnalysisCache,
  type CacheOptions,
  type CacheStats,
} from './cache/index.js';
export * as gitUtil from './git/index.js';
