import type { RepoFile } from '@strata/sdk';
import { matchedFiles } from './filter.js';
import { orderStages } from './order.js';
import type { PlannedStage, Stage, StagePlan } from './types.js';

/**
 * A run's stages, ordered and settled: who runs, in what order, over which
 * files — and who does not run at all.
 *
 * Settled before the first stage starts, because both halves have readers that
 * cannot wait. A configuration that cannot be ordered has to fail while the
 * failure still costs nothing, and a stage that will never be called must not
 * be counted as a step somebody is waiting for.
 *
 * A stage that declared a filter and matched no file is skipped: it has nothing
 * to work on, and the entry in the report says so rather than leaving a reader
 * to read "found nothing" into a stage that never ran (`docs/adr/0015`). A
 * stage that declared *no* filter reads no files of its own — it consumes what
 * other stages produced — and is planned with none.
 */
export function planStages(
  stages: readonly Stage[],
  files: readonly RepoFile[],
): StagePlan {
  return orderStages(stages).map((stage) => {
    if (!stage.filter) return { stage, files: [] };
    const matched = matchedFiles(files, stage.filter);
    return matched.length > 0
      ? { stage, files: matched }
      : {
          stage,
          files: matched,
          skipped: 'its filter matched no file at this revision',
        };
  });
}

/** The stages a run actually calls — the steps it plans and reports. */
export function stagesToRun(plan: StagePlan): PlannedStage[] {
  return plan.filter((planned) => planned.skipped === undefined);
}
