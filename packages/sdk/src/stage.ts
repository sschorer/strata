import type { OutputType, StageOutputs } from './output.js';

/**
 * How a stage ended. `skipped` covers both "its filter matched nothing" and
 * "something it consumes never arrived", which are the same thing to a reader:
 * the stage did not run, and nothing it would have said is known.
 */
export type StageStatus = 'ok' | 'failed' | 'skipped';

/** A stage that ran and produced what it declared. */
export interface StageOk<T extends OutputType = OutputType> {
  status: 'ok';
  /** The output type it declared it produces. */
  type: T;
  output: StageOutputs[T];
}

/** A stage that ran and threw. Its output is not knowable, not empty. */
export interface StageFailed<T extends OutputType = OutputType> {
  status: 'failed';
  type: T;
  /** Why, in one line — what the screen that would have shown the output prints. */
  reason: string;
}

/** A stage that never ran: nothing to work on, or an upstream that failed. */
export interface StageSkipped<T extends OutputType = OutputType> {
  status: 'skipped';
  type: T;
  reason: string;
}

/**
 * One stage's slot in a report — a status, and the output only when it
 * succeeded.
 *
 * An envelope rather than a bare output with the trouble recorded elsewhere: a
 * consumer must not be able to read an output without seeing that it is absent,
 * because *Dead code* rendering "0 findings" for a stage that crashed is the
 * exact failure this shape exists to prevent (`docs/adr/0015`).
 *
 * `type` is carried whatever the status, so an entry says what it *would* have
 * held. It is also the discriminant that narrows `output`: switching on it and
 * on `status` renders a report without knowing which stages ran, which is what
 * lets a new stage appear on screen without the UI being rebuilt for it.
 */
export type StageEntry<T extends OutputType = OutputType> = {
  [K in T]: StageOk<K> | StageFailed<K> | StageSkipped<K>;
}[T];
