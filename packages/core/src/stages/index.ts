/**
 * The scheduler: a run's stages, ordered from what their manifests declared,
 * filtered by the core on their behalf, and run with what each one consumes.
 *
 * Nothing in here knows what a stage *means* — that is the point of
 * [ADR-10](../../../../docs/adr/0010-open-analysis-pipeline.md): the core plans
 * from declarations, so the pipeline grows without it.
 */
export { declaredStages } from './declared.js';
export { exclusiveStages } from './exclusive.js';
export { orderStages } from './order.js';
export { matchedFiles } from './filter.js';
export { planStages, stagesToRun } from './plan.js';
export { runStages } from './run.js';
export { stageOk, stageSkipped } from './entry.js';
export { consumedInputs, noOutputs, type ProducedOutputs } from './inputs.js';
export { stageRunKey, type HistoryWindow } from './key.js';
export { UnchosenStageGroupError, UnorderableStagesError } from './errors.js';
export type {
  PlannedStage,
  Stage,
  StagePlan,
  StageProvenance,
} from './types.js';
export type { StageResults, StageRunOptions } from './run.js';
