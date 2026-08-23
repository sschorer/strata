import type { OutputType, StageEntry, StageOutput } from '@strata/sdk';

/**
 * A stage's slot in the report, built for one stage's declared output type.
 *
 * The cast is the seam between a scheduler that treats every output type alike
 * and an entry whose `output` is narrowed by its `type`. The core cannot prove
 * the correlation — it has a `produces` read out of JSON and whatever the
 * module returned — so it is asserted in these two lines, where the manifest
 * validation behind them is one file away, rather than at every call site.
 */
export function stageOk(type: OutputType, output: StageOutput): StageEntry {
  return { status: 'ok', type, output } as StageEntry;
}

/** A stage that never ran, and what a screen prints where its output would be. */
export function stageSkipped(type: OutputType, reason: string): StageEntry {
  return { status: 'skipped', type, reason } as StageEntry;
}
