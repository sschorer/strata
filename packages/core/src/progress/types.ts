/**
 * Where an analysis has got to, as the pipeline reports it while it runs.
 *
 * The stages are the pipeline's own sequence, not a percentage dressed up: a
 * reader following a run sees the same steps `Strata.analyze` takes, and three
 * of them (`stage`, `language`, `metric`) repeat once per plugin that takes
 * part. `stage` is the scheduled pipeline; the other two are the plugin kinds
 * that have not migrated to it yet.
 */
export type AnalysisStage =
  /** Resolving the revision and the branch it names. */
  | 'resolving'
  /** Listing the tracked files and narrowing them to the project's scope. */
  | 'scanning'
  /** One language plugin parsing the files it claims; `detail` is its id. */
  | 'language'
  /** One stage the scheduler ordered; `detail` is its plugin id. */
  | 'stage'
  /** Reading the commit log for the history window. */
  | 'history'
  /** One git-metric plugin folding that log; `detail` is its id. */
  | 'metric'
  /**
   * Parsing the log with a convention that has not migrated to a stage. A
   * convention that has is a `stage` step like any other, and so is the fold.
   */
  | 'commits'
  /** Everything is done and the report is being handed back. */
  | 'finished';

export interface AnalysisProgress {
  stage: AnalysisStage;
  /** What the stage is working on — a plugin id — or null when it names nothing. */
  detail: string | null;
  /** Steps this run has finished before the one `stage` describes. */
  completed: number;
  /**
   * Steps the whole run holds, or `0` while that is not knowable yet. How many
   * plugins take part follows from the file list, so the two stages before it
   * exists report an honest unknown rather than a total that shifts under the
   * reader.
   */
  total: number;
}

/** Handed every step of a run, in order, while it runs. */
export type ProgressListener = (progress: AnalysisProgress) => void;
