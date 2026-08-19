import type {
  AnalysisProgress,
  AnalysisReport,
  AnalyzeOptions,
} from '@strata/core';

/**
 * What the HTTP thread asks the analysis thread to do. Every command carries a
 * correlation id, because the answers come back over one port and arrive
 * whenever the work is done.
 */
export type WorkerCommand =
  | { type: 'analyze'; id: string; options: AnalyzeOptions }
  | { type: 'clear-cache'; id: string };

/** What the analysis thread says back, against the id it was asked. */
export type WorkerEvent =
  | { type: 'progress'; id: string; progress: AnalysisProgress }
  | { type: 'done'; id: string; report?: AnalysisReport }
  | { type: 'failed'; id: string; message: string };
