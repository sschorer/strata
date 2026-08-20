/**
 * @strata/sdk — the contracts every Strata plugin implements.
 *
 * There are three plugin kinds, each a small, versioned interface:
 *   - LanguagePlugin          per-language static analysis (deps, dead code, metrics)
 *   - CommitConventionPlugin  parse a commit message into structured meaning
 *   - GitMetricPlugin         derive a metric series from repository history
 *
 * AI is not among them: a provider is a configured instance in the app
 * settings, and nothing in an analysis may call a model (docs/adr/0013).
 *
 * A plugin is a package with a `strata.plugin.json` manifest whose `main`
 * default-exports one of the `define*` helpers below. The core loads manifests,
 * imports the entry, and registers the returned object.
 *
 * This file is a barrel: one concern per module, re-exported here as the public
 * surface. Import from `@strata/sdk`, never from a submodule path.
 */

// Shared vocabulary
export * from './version.js';
export * from './manifest.js';
export * from './logger.js';
export * from './cache.js';
export * from './repo.js';
export * from './graph.js';
export * from './summary.js';

// The three plugin kinds
export * from './language.js';
export * from './commit.js';
export * from './metric.js';
export * from './plugin.js';
