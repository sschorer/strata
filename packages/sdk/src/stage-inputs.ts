import type { OutputType, StageOutputs } from './output.js';

/**
 * What arrived for one output type: every upstream output of it, keyed by the
 * manifest id of the plugin that produced it.
 *
 * Keyed rather than concatenated because a consumer that means one specific
 * producer has to be able to find it, and one that does not can read the
 * values and never learn which plugins are installed.
 */
export type StageInput<T extends OutputType> = Record<string, StageOutputs[T]>;

/**
 * Everything produced upstream of a stage, by output type and then by producer.
 *
 * Only the types the manifest named in `consumes` are filled in — the rest
 * arrive empty, because an output a stage did not declare is an output the
 * core did not put in its cache key, and reading it would make the stage stale
 * on the next run (`docs/adr/0010`).
 */
export type StageInputs = { [K in OutputType]: StageInput<K> };
