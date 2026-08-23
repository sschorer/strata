import type { AnalysisProgress, ProgressListener } from '../progress/index.js';
import type { AnalysisReport, AnalyzeOptions } from '../types.js';

/**
 * Where a job is. `queued` and `running` are live and will change again; the
 * other three are final and never do.
 *
 * `partial` is a run that produced a report with a hole in it: a stage threw,
 * everything downstream of it was skipped, and the rest of the pipeline ran
 * ([ADR-15](../../../../docs/adr/0015-partial-runs-and-per-stage-status.md)).
 * It is a state of its own rather than a flavour of `succeeded` because the
 * two must not be confused by anyone acting on the outcome — a partial run
 * never passes a gate — nor by anyone reading it, since it did produce a
 * report and `failed` says there is none to collect.
 */
export type JobState =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed';

/** One analysis, from the moment it was asked for to whatever became of it. */
export interface AnalysisJob {
  id: string;
  /**
   * Working-tree root this job analyses — how a screen decides whether a job
   * belongs to the project it is showing.
   */
  root: string;
  state: JobState;
  /** Where the run has got to; null until it starts. */
  progress: AnalysisProgress | null;
  queuedAt: string;
  /** When it left the queue, ISO 8601; null while it is still in it. */
  startedAt: string | null;
  /** When it reached a final state, ISO 8601; null while it has not. */
  finishedAt: string | null;
  /**
   * The report, once the run produced one — which a `partial` run did, and so
   * did a `failed` one whose stages all threw. A run that failed before it had
   * anything to report has none.
   */
  report: AnalysisReport | null;
  /** Why it failed, once it did. */
  error: string | null;
}

/**
 * A job without its report — what a list of jobs carries. Reports run to
 * megabytes on a large repository, and a list of twenty of them is a download
 * nobody asked for; `GET /jobs/:id` is where the report lives.
 */
export type AnalysisJobSummary = Omit<AnalysisJob, 'report'>;

/**
 * What actually runs an analysis for a queue. The queue owns *when* work
 * happens; a runner owns *where* — in this thread, or in a worker that leaves
 * the caller's event loop free.
 */
export interface AnalysisRunner {
  analyze(
    options: AnalyzeOptions,
    onProgress: ProgressListener,
  ): Promise<AnalysisReport>;
  /** Forget every cached result. */
  clearCache(): Promise<void>;
  /** Release whatever backs the runner; nothing is run through it afterwards. */
  close(): Promise<void>;
}

/** Handed the job every time it changes, until it settles. */
export type JobListener = (job: AnalysisJob) => void;

export interface QueueOptions {
  /**
   * How many settled jobs stay answerable, newest first (default 20). A
   * finished job has to outlive its own event stream — a browser that
   * reconnects a moment late still has to be able to collect the report.
   */
  history?: number;
}
