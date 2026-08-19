import { Worker } from 'node:worker_threads';
import type { WorkerCommand, WorkerEvent } from './protocol.js';

/**
 * The part of a `Worker` the runner uses. Naming it keeps the runner's message
 * bookkeeping testable without a real thread — and a real `Worker` satisfies it
 * as it is.
 */
export interface AnalysisThread {
  postMessage(command: WorkerCommand): void;
  on(event: 'message', listener: (value: WorkerEvent) => void): unknown;
  on(event: 'error', listener: (err: Error) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  terminate(): Promise<number>;
}

/** Builds the thread a runner talks to. The seam a test replaces. */
export type SpawnThread = (data: unknown) => AnalysisThread;

/**
 * Start the real analysis thread. The entry point sits next to this module in
 * the build output, so it is resolved relative to it rather than from a working
 * directory the server does not control.
 */
export const spawnThread: SpawnThread = (data) =>
  new Worker(new URL('./analysis-worker.js', import.meta.url), {
    workerData: data,
    // The thread logs plugin loads and cache warnings; they belong in the
    // server's output, not in a stream nobody reads.
    stdout: false,
    stderr: false,
  });
