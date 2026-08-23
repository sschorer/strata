import type { OutputType, StageOutputs } from './output.js';
import type { StageContext } from './stage-context.js';

/**
 * A plugin that contributes one **stage** to the pipeline.
 *
 * Everything the core needs to *place* the stage — what it consumes, what it
 * produces, the files it wants, the group it is exclusive with — is in the
 * manifest rather than here, so a run can be planned without importing this
 * module (`docs/adr/0010`). What is left on the object is the work itself.
 *
 * `run` is handed a `StageContext` and returns the one output type the manifest
 * declared. It is called at most once per run, with the files its filter
 * matched, and its result is what a report's stage entry carries.
 */
export interface StagePlugin<T extends OutputType = OutputType> {
  kind: 'stage';
  run(ctx: StageContext): Promise<StageOutputs[T]>;
}

/**
 * Define a stage. Name the output type the manifest declares — `defineStage<'metrics'>`
 * — and the return type of `run` is checked against it here rather than at the
 * far end of a run.
 */
export function defineStage<T extends OutputType = OutputType>(
  p: Omit<StagePlugin<T>, 'kind'>,
): StagePlugin<T> {
  return { kind: 'stage', ...p };
}
