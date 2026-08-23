import type { OutputType } from '@strata/sdk';
import type { AnalysisReport } from '$lib/api';
import { stagesProducing, type ReportStage } from './entries';

/**
 * A stage with no output to show, as the screen standing in its place prints
 * it: which stage, whether it ran, and why there is nothing here.
 *
 * The two statuses are two different things to a reader. `failed` means the
 * stage ran and threw, so what it would have said is *not knowable*; `skipped`
 * means it never ran at all — either an upstream failed, and `blockedBy` names
 * the stage somebody has to fix, or its filter matched nothing, which is an
 * empty branch rather than a hole (`docs/adr/0015`).
 */
export interface StageTrouble {
  /** Manifest id of the plugin whose stage this is. */
  id: string;
  status: 'failed' | 'skipped';
  /** Why, in the one line the entry carries. */
  reason: string;
  /** The stage whose failure took this one out of the run, when one did. */
  blockedBy?: string;
}

/** Every stage producing `type` that has nothing to show, and why. */
export function troublesProducing(
  report: AnalysisReport,
  type: OutputType,
): StageTrouble[] {
  return stagesProducing(report, type).flatMap(troubleOfStage);
}

/**
 * What became of one named stage, when it produced nothing — `null` both when
 * it succeeded and when this run never planned it at all.
 *
 * The two are the same to the screen asking: neither is trouble to report.
 * Whether there was a stage at all is `stagesProducing`'s answer, and a screen
 * with no stage of its output type shows an empty state rather than a failure.
 */
export function troubleOf(
  report: AnalysisReport,
  id: string,
): StageTrouble | null {
  const entry = report.stages?.[id];
  if (!entry) return null;
  return troubleOfStage({ id, entry })[0] ?? null;
}

/** The entry as trouble, or nothing at all when the stage succeeded. */
function troubleOfStage({ id, entry }: ReportStage): StageTrouble[] {
  if (entry.status === 'ok') return [];
  return [
    {
      id,
      status: entry.status,
      reason: entry.reason,
      ...(entry.status === 'skipped' && entry.blockedBy
        ? { blockedBy: entry.blockedBy }
        : {}),
    },
  ];
}
