import type { OutputType, StageEntry, StageOutputs } from '@strata/sdk';

/**
 * A stage that ran and produced what it declared.
 *
 * The core asserts the same correlation when it builds an entry — a `produces`
 * read out of JSON beside whatever the module returned — so a fixture states
 * the pair it means and the cast stays in one place here.
 */
export function okStage<T extends OutputType>(
  type: T,
  output: StageOutputs[T],
): StageEntry {
  return { status: 'ok', type, output } as StageEntry;
}

/** A stage that ran and threw: its output is not knowable, not empty. */
export function failedStage(type: OutputType, reason: string): StageEntry {
  return { status: 'failed', type, reason } as StageEntry;
}

/**
 * A stage that never ran. Pass `blockedBy` for one an upstream failure took
 * out of the run, and leave it off for one whose filter matched nothing —
 * which is the difference a screen has to be able to show.
 */
export function skippedStage(
  type: OutputType,
  reason: string,
  blockedBy?: string,
): StageEntry {
  return {
    status: 'skipped',
    type,
    reason,
    ...(blockedBy ? { blockedBy } : {}),
  } as StageEntry;
}
