/**
 * The analysis queue — heavy runs asked for now and collected later, one at a
 * time, watchable while they run.
 */
export { AnalysisQueue } from './queue.js';
export { inlineRunner } from './inline.js';
export { requestKey } from './key.js';
export { jobSummary } from './summary.js';
export type {
  AnalysisJob,
  AnalysisJobSummary,
  AnalysisRunner,
  JobListener,
  JobState,
  QueueOptions,
} from './types.js';
