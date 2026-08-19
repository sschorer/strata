import type { AnalysisJob, AnalysisJobSummary } from './types.js';

/**
 * A job with its report left off — see `AnalysisJobSummary`.
 *
 * Written out field by field rather than destructured, so a field added to a
 * job has to be decided about here too: silently dropping one from every list
 * would be a worse bug than repeating nine names.
 */
export function jobSummary(job: AnalysisJob): AnalysisJobSummary {
  return {
    id: job.id,
    root: job.root,
    state: job.state,
    progress: job.progress,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    error: job.error,
  };
}
