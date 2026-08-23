/**
 * @strata/sdk — the contracts every Strata plugin implements.
 *
 * A plugin contributes a **stage**: `run(ctx)` over the files its manifest
 * filtered for and the outputs it consumes, producing one output type. Three
 * older kinds are still honoured until the last plugin has migrated to it:
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
 * A manifest may also declare the plugin's **stage**: what it consumes, what it
 * produces, what files it filters on and what it is exclusive with. Those are
 * static JSON on purpose — the core plans a run from them without importing
 * anything (`docs/adr/0010`) — and the shapes behind them are `OutputType` and
 * `StageEntry`, a report's per-stage slot.
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
export * from './cycle.js';
export * from './summary.js';
export * from './finding.js';

// The pipeline: what a stage is given, what it produces, and its slot in a report
export * from './output.js';
export * from './stage-inputs.js';
export * from './stage-context.js';
export * from './stage-plugin.js';
export * from './stage.js';

// The three plugin kinds
export * from './language.js';
export * from './commit.js';
export * from './metric.js';
export * from './plugin.js';
