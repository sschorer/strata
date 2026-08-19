import type { Strata } from '../strata.js';
import type { AnalysisRunner } from './types.js';

/**
 * An `AnalysisRunner` that runs in the calling thread.
 *
 * The queue's other properties still hold — one run at a time, identical
 * requests joined, a job that outlives its request — but the event loop is busy
 * for the length of the run, so this is for an embedder that has no other work
 * to do meanwhile: a CI job, a script, a test. A server wants the worker
 * runner, which is the whole point of putting a queue in front of the pipeline.
 */
export function inlineRunner(strata: Strata): AnalysisRunner {
  return {
    analyze: (options, onProgress) => strata.analyze(options, onProgress),
    clearCache: async () => strata.clearCache(),
    close: async () => strata.close(),
  };
}
