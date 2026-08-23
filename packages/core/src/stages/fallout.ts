import type { OutputType } from '@strata/sdk';

/**
 * What a run has lost to a stage that threw: each output type no reader can
 * trust for the rest of this run, and the stage whose failure cost it.
 *
 * A type rather than a stage id, because that is how the graph is wired — a
 * stage consumes `graph`, never `language-typescript` — so "downstream of the
 * failure" is exactly "consumes something a failed stage was going to produce"
 * (`docs/adr/0015`). A stage that would have received two graphs and can now
 * only be handed one is downstream too: it was declared to work on every graph
 * in the run, and an answer computed from half of them is the "0 findings"
 * that ADR-15 exists to prevent.
 *
 * The value is the stage that *failed*, carried forward hop by hop rather than
 * the nearest casualty, because a chain three stages long still has exactly one
 * thing in it somebody can fix.
 */
export type LostOutputs = Map<OutputType, string>;

/** A run before anything has gone wrong in it. */
export function nothingLost(): LostOutputs {
  return new Map();
}

/**
 * Record that nothing of `type` will arrive after all, because `origin` failed.
 *
 * The first failure keeps the type: it is the one that started the chain, and a
 * second producer of the same type going down later adds nothing a reader can
 * act on.
 */
export function lose(
  lost: LostOutputs,
  type: OutputType,
  origin: string,
): void {
  if (!lost.has(type)) lost.set(type, origin);
}

/**
 * The failure that takes a stage consuming these types out of the run, or
 * `undefined` when it is on a branch the failure never reached — which is the
 * whole point of computing this at all.
 */
export function blockedBy(
  lost: LostOutputs,
  consumes: readonly OutputType[],
): string | undefined {
  for (const type of consumes) {
    const origin = lost.get(type);
    if (origin !== undefined) return origin;
  }
  return undefined;
}
