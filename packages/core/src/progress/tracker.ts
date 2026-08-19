import type {
  AnalysisStage,
  ProgressListener,
} from './types.js';

/**
 * Counts a run's steps and hands each one to a listener, so the pipeline says
 * `enter('language', id)` and nothing else has to carry a counter.
 *
 * A run with no listener is the normal case (CI, a script, a test), so every
 * method here is a no-op then — the pipeline pays nothing for being watchable.
 */
export class ProgressTracker {
  #completed = 0;
  #total = 0;

  constructor(private readonly listener?: ProgressListener) {}

  /**
   * How many steps this run holds, once the file list makes that knowable.
   * Called once, between `scanning` and the first plugin.
   */
  plan(total: number): void {
    this.#total = total;
  }

  /**
   * Announce the step that is about to run. The count is of steps already
   * finished, so a reader sees "3 of 8 done, now parsing language-typescript"
   * rather than a step claiming to be over before it started.
   */
  enter(stage: AnalysisStage, detail: string | null = null): void {
    this.listener?.({
      stage,
      detail,
      completed: this.#completed,
      total: this.#total,
    });
    this.#completed++;
  }

  /**
   * The run is over. Reports what was actually done as the total, so a plan
   * that turned out wrong corrects itself instead of ending at 7 of 8.
   */
  finish(): void {
    this.listener?.({
      stage: 'finished',
      detail: null,
      completed: this.#completed,
      total: this.#completed,
    });
  }
}
