import type { OutputType, StageEntry, StageOutput } from '@strata/sdk';

/**
 * A stage's slot in the report, built for one stage's declared output type.
 *
 * The cast is the seam between a scheduler that treats every output type alike
 * and an entry whose `output` is narrowed by its `type`. The core cannot prove
 * the correlation — it has a `produces` read out of JSON and whatever the
 * module returned — so it is asserted in the four constructors here, where the
 * manifest validation behind them is one file away, rather than at every call
 * site.
 */
export function stageOk(type: OutputType, output: StageOutput): StageEntry {
  return { status: 'ok', type, output } as StageEntry;
}

/** A stage that never ran, and what a screen prints where its output would be. */
export function stageSkipped(type: OutputType, reason: string): StageEntry {
  return { status: 'skipped', type, reason } as StageEntry;
}

/**
 * A stage that ran and threw. What it would have said is not knowable, so the
 * entry carries the failure in place of an output rather than an empty one
 * (`docs/adr/0015`).
 */
export function stageFailed(type: OutputType, reason: string): StageEntry {
  return { status: 'failed', type, reason } as StageEntry;
}

/**
 * A stage taken out of the run by a failure upstream of it — it consumes an
 * output type whose producer threw, so what it would have been handed does not
 * exist.
 *
 * `blockedBy` names the stage that *failed*, however many hops back it was:
 * that is the one somebody has to fix, and it is what tells this entry apart
 * from a stage that simply had nothing to work on.
 */
export function stageBlocked(type: OutputType, blockedBy: string): StageEntry {
  return {
    status: 'skipped',
    type,
    reason: `"${blockedBy}" failed, and this stage consumes what it produces`,
    blockedBy,
  } as StageEntry;
}
