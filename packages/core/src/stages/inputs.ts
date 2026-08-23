import {
  OUTPUT_TYPES,
  type OutputType,
  type StageInputs,
  type StageOutput,
} from '@strata/sdk';

/**
 * Everything produced so far in a run, by output type and then by the manifest
 * id of the stage that produced it. The scheduler's working set: what a stage
 * about to run may be handed.
 */
export type ProducedOutputs = StageInputs;

/** A run's outputs before any stage has produced one. */
export function noOutputs(): ProducedOutputs {
  return Object.fromEntries(
    OUTPUT_TYPES.map((type) => [type, {}]),
  ) as ProducedOutputs;
}

/** Record what a stage produced, for whoever consumes that type downstream. */
export function record(
  produced: ProducedOutputs,
  id: string,
  type: OutputType,
  output: StageOutput,
): void {
  (produced[type] as Record<string, StageOutput>)[id] = output;
}

/**
 * What one stage receives: every upstream output of each type it declared it
 * consumes, keyed by producer, and nothing else.
 *
 * A type the stage did not declare arrives empty rather than absent, so a stage
 * reading one is reading an empty object rather than crashing — and is still
 * reading nothing, because an undeclared input is one the core did not put in
 * the stage's cache key and would serve stale on the next run.
 */
export function consumedInputs(
  produced: ProducedOutputs,
  consumes: readonly OutputType[],
): StageInputs {
  const inputs = noOutputs();
  for (const type of consumes) {
    (inputs as Record<string, unknown>)[type] = produced[type];
  }
  return inputs;
}
