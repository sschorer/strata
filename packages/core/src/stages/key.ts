import type { RepoFile, StageInputs } from '@strata/sdk';
import { digest, filesDigest } from '../cache/index.js';
import type { Stage } from './types.js';

/** The part of a run a stage that reads the commit log depends on. */
export interface HistoryWindow {
  /** A shallow clone can hold a different history for the same sha. */
  root: string;
  rev: string;
  /** The cap the run was given, if any. */
  limit?: number;
  /** How many commits the window actually held. */
  commits: number;
}

/**
 * The cache key of one stage's whole result: everything the core handed it, and
 * nothing else.
 *
 * That is what `consumes` and `filter` buy — the key covers the files the
 * stage's filter matched and the outputs it declared it consumes, so an
 * unrelated file changing does not invalidate it. The history window joins the
 * key only for a stage that consumes `commits`, because that stage is the one
 * that was handed the window; keying every stage on the revision would undo the
 * whole arrangement, as a commit touching a README would then invalidate a
 * TypeScript graph.
 *
 * The stage's id and version are not in here: the cache holds both already, so
 * a new plugin build invalidates exactly its own entries.
 */
export function stageRunKey(
  stage: Stage,
  files: readonly RepoFile[],
  inputs: StageInputs,
  window: HistoryWindow,
): string {
  const consumed = [...stage.consumes].sort();
  return digest([
    'stage',
    stage.produces,
    filesDigest(files),
    ...consumed.flatMap((type) => [
      type,
      ...Object.entries(inputs[type])
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .flatMap(([id, output]) => [id, JSON.stringify(output) ?? 'undefined']),
    ]),
    ...(consumed.includes('commits')
      ? [window.root, window.rev, window.limit, window.commits]
      : []),
  ]);
}
