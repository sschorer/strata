import type {
  RawCommit,
  RepoContext,
  StageEntry,
  StageOutput,
} from '@strata/sdk';
import type { AnalysisCache } from '../cache/index.js';
import type { ProgressTracker } from '../progress/index.js';
import { stageBlocked, stageFailed, stageOk, stageSkipped } from './entry.js';
import { blockedBy, lose, nothingLost } from './fallout.js';
import {
  consumedInputs,
  noOutputs,
  record,
  type ProducedOutputs,
} from './inputs.js';
import { stageRunKey, type HistoryWindow } from './key.js';
import type { StagePlan, StageProvenance } from './types.js';

export interface StageRunOptions {
  plan: StagePlan;
  /** The repository as this run sees it, minus what the core scopes per stage. */
  repo: Omit<RepoContext, 'cache' | 'files'>;
  /** The run's history window; only a stage that consumes commits is given it. */
  history: readonly RawCommit[];
  /** What that window is, for the cache key of the stages that read it. */
  window: HistoryWindow;
  cache: AnalysisCache;
  progress: ProgressTracker;
}

/** What a run's stages left behind: the report's half, and the scheduler's. */
export interface StageResults {
  /** One entry per planned stage, keyed by manifest id (`docs/adr/0015`). */
  entries: Record<string, StageEntry>;
  /** Every planned stage in the order it was ordered, with its version. */
  provenance: StageProvenance[];
  /** What they produced, for whoever reads a report's older fields. */
  outputs: ProducedOutputs;
}

/**
 * Run a planned set of stages in order and collect what they said.
 *
 * Each stage is handed only what it declared: the files its filter matched, the
 * outputs of the types it consumes keyed by producer, and — when it consumes
 * commits — the run's history window. Nothing about which plugins are installed
 * reaches a stage, which is what lets one written today consume a graph from a
 * language module written next year (`docs/adr/0010`).
 *
 * A stage whose whole input digests to a stored result is not called at all;
 * one that runs writes its result back before the next stage starts, so a run
 * interrupted halfway keeps what it had already earned.
 *
 * **A stage that throws costs its own branch and no more.** It is recorded as
 * failed, every stage consuming an output type it was going to produce is
 * recorded as skipped naming it, and the rest of the order runs and reports as
 * it always did — because once anyone can add a stage, one of them dividing by
 * zero must not discard twenty minutes of analysis that had nothing to do with
 * it (`docs/adr/0015`). It also writes no run entry, so a retry re-runs what
 * failed and nothing else.
 */
export async function runStages({
  plan,
  repo,
  history,
  window,
  cache,
  progress,
}: StageRunOptions): Promise<StageResults> {
  const entries: Record<string, StageEntry> = {};
  const outputs = noOutputs();
  const lost = nothingLost();

  for (const { stage, files, skipped } of plan) {
    if (skipped !== undefined) {
      entries[stage.id] = stageSkipped(stage.produces, skipped);
      continue;
    }

    // Nothing it consumes is going to arrive, so there is no run to make: it
    // is not entered as a step either, and `progress.finish()` reports what the
    // run actually did rather than the plan it was given.
    const failure = blockedBy(lost, stage.consumes);
    if (failure !== undefined) {
      entries[stage.id] = stageBlocked(stage.produces, failure);
      lose(lost, stage.produces, failure);
      continue;
    }

    progress.enter('stage', stage.id);
    const inputs = consumedInputs(outputs, stage.consumes);
    const runKey = stageRunKey(stage, files, inputs, window);
    const hit = cache.getRun<StageOutput>(stage.id, stage.version, runKey);

    let output: StageOutput;
    try {
      output =
        hit ??
        (await stage.run({
          ...repo,
          files,
          inputs,
          history: stage.consumes.includes('commits') ? history : [],
          cache: cache.scope(stage.id, stage.version),
        }));
    } catch (err) {
      // Nothing is written back for it: the whole-stage entry is what a retry
      // would be served, and serving a stored answer for a stage that threw
      // would make the failure permanent. Whatever it cached per file on the
      // way is keyed by blob and stays true, so the retry pays only for the
      // work it has to redo.
      entries[stage.id] = stageFailed(stage.produces, message(err));
      lose(lost, stage.produces, stage.id);
      continue;
    }

    if (!hit) {
      cache.setRun(stage.id, stage.version, runKey, output);
      cache.flush();
    }
    record(outputs, stage.id, stage.produces, output);
    entries[stage.id] = stageOk(stage.produces, output);
  }

  return {
    entries,
    provenance: plan.map(({ stage }) => ({
      id: stage.id,
      version: stage.version,
      status: entries[stage.id]!.status,
    })),
    outputs,
  };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
