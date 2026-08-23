import type { OutputType, StageEntry, StageOutputs } from '@strata/sdk';
import type { AnalysisReport } from '$lib/api';

/** One stage's slot in a report, beside the id of the plugin behind it. */
export interface ReportStage<T extends OutputType = OutputType> {
  /** Manifest id of the producing plugin — what the report keys the entry by. */
  id: string;
  entry: StageEntry<T>;
}

/** What one stage produced, once it is known that it did. */
export interface StageProduct<T extends OutputType = OutputType> {
  id: string;
  output: StageOutputs[T];
}

/**
 * Every stage this run planned that produces `type`, whatever became of each —
 * in the order the report keys them, which is the order the workbench loaded
 * the plugins.
 *
 * By output type rather than by id, because that is what a screen means: the
 * dependency screen wants whoever produced a graph, not the TypeScript module
 * in particular, so a language module written years later reaches it with no
 * change here (`docs/adr/0010`).
 *
 * Every report the server sends carries its entries; the fallback keeps a
 * screen rendering an empty state rather than throwing if one ever arrives
 * without, as the run summary is read the same way.
 */
export function stagesProducing<T extends OutputType>(
  report: AnalysisReport,
  type: T,
): ReportStage<T>[] {
  return Object.entries(report.stages ?? {})
    .filter(([, entry]) => entry.type === type)
    .map(([id, entry]) => ({ id, entry: entry as StageEntry<T> }));
}

/**
 * What the stages producing `type` actually produced — the ones that succeeded,
 * and only those.
 *
 * A stage that failed or never ran has no output to fold in, and reading one
 * out of it is the mistake the entry shape exists to prevent: ask
 * `troublesProducing` for those, and print them where their output would have
 * been (`docs/adr/0015`).
 */
export function outputsProducing<T extends OutputType>(
  report: AnalysisReport,
  type: T,
): StageProduct<T>[] {
  return stagesProducing(report, type).flatMap(({ id, entry }) =>
    entry.status === 'ok' ? [{ id, output: entry.output }] : [],
  );
}

/**
 * The output of an output type only one stage in a run can produce — the parsed
 * commit log, whichever convention parsed it.
 *
 * `null` when nothing produced one, which a screen must tell apart from an
 * empty one: the conventions share an exclusive group, so a run has one parsed
 * log or none, and none means nobody said what this history conforms to.
 */
export function soleOutputOf<T extends OutputType>(
  report: AnalysisReport,
  type: T,
): StageOutputs[T] | null {
  return outputsProducing(report, type)[0]?.output ?? null;
}

/**
 * What one named stage produced, or `null` unless it ran and succeeded.
 *
 * The lookup for a screen that means one specific producer — the hotspot
 * treemap reads the churn and complexity behind a score, which is that stage's
 * own contract and not something every metric series carries. `type` is checked
 * as well as the id, so a workbench where the id belongs to something else
 * answers nothing rather than the wrong shape.
 */
export function outputOf<T extends OutputType>(
  report: AnalysisReport,
  id: string,
  type: T,
): StageOutputs[T] | null {
  const entry = report.stages?.[id];
  if (!entry || entry.type !== type || entry.status !== 'ok') return null;
  return entry.output as StageOutputs[T];
}
