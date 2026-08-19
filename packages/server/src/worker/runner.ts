import { randomUUID } from 'node:crypto';
import type {
  AnalysisReport,
  AnalysisRunner,
  AnalyzeOptions,
  ProgressListener,
} from '@strata/core';
import type { RegistryOptions } from '../registry.js';
import type { WorkerEvent } from './protocol.js';
import { spawnThread, type AnalysisThread, type SpawnThread } from './thread.js';

export interface WorkerRunnerOptions {
  /** What the thread loads: the plugins directory, and whether to read it. */
  registry: RegistryOptions;
  /** How the thread is started. Defaults to a real `worker_threads` worker. */
  spawn?: SpawnThread;
}

/** One command in flight, waiting for the thread to answer it. */
interface Pending {
  settle: (report?: AnalysisReport) => void;
  fail: (message: string) => void;
  onProgress?: ProgressListener;
}

/**
 * An `AnalysisRunner` backed by a worker thread, so a run never occupies the
 * event loop that has to answer requests.
 *
 * The thread is started on the first command and kept, because the two things
 * that make an analysis fast — a loaded plugin registry and an open incremental
 * cache — are exactly the things a fresh thread would not have. A workbench
 * that is never asked to analyse anything never pays for it at all.
 *
 * A thread that dies takes the commands in flight with it and is not replaced
 * in place: the next command starts a new one. So a plugin that crashes the
 * thread costs its own run and a reload, rather than the server.
 */
export function workerRunner(options: WorkerRunnerOptions): AnalysisRunner {
  const spawn = options.spawn ?? spawnThread;
  const pending = new Map<string, Pending>();
  let thread: AnalysisThread | null = null;
  let closed = false;

  function ensureThread(): AnalysisThread {
    if (thread) return thread;
    const started = spawn(options.registry);
    thread = started;
    started.on('message', (event: WorkerEvent) => receive(event));
    started.on('error', (err: Error) =>
      abandon(started, `the analysis thread failed: ${err.message}`),
    );
    started.on('exit', () =>
      abandon(started, 'the analysis thread stopped before it answered'),
    );
    return started;
  }

  function receive(event: WorkerEvent): void {
    const waiting = pending.get(event.id);
    if (!waiting) return;
    if (event.type === 'progress') {
      waiting.onProgress?.(event.progress);
      return;
    }
    pending.delete(event.id);
    if (event.type === 'done') waiting.settle(event.report);
    else waiting.fail(event.message);
  }

  /** The thread is gone: fail everything it still owed and forget it. */
  function abandon(dead: AnalysisThread, reason: string): void {
    if (thread === dead) thread = null;
    for (const [id, waiting] of pending) {
      pending.delete(id);
      waiting.fail(reason);
    }
  }

  function send(
    command: { type: 'analyze'; options: AnalyzeOptions } | { type: 'clear-cache' },
    onProgress?: ProgressListener,
  ): Promise<AnalysisReport | undefined> {
    if (closed) {
      return Promise.reject(new Error('The analysis thread is shut down.'));
    }
    const id = randomUUID();
    return new Promise<AnalysisReport | undefined>((resolve, reject) => {
      pending.set(id, {
        onProgress,
        settle: resolve,
        fail: (message) => reject(new Error(message)),
      });
      try {
        ensureThread().postMessage({ ...command, id });
      } catch (err) {
        pending.delete(id);
        reject(err as Error);
      }
    });
  }

  return {
    async analyze(analyzeOptions, onProgress) {
      const report = await send(
        { type: 'analyze', options: analyzeOptions },
        onProgress,
      );
      if (!report) {
        throw new Error('The analysis thread answered without a report.');
      }
      return report;
    },

    async clearCache() {
      await send({ type: 'clear-cache' });
    },

    async close() {
      closed = true;
      const running = thread;
      thread = null;
      if (!running) return;
      // `exit` fires from the termination and fails whatever was still in
      // flight, which is what the queue turns into a failed job.
      await running.terminate();
    },
  };
}
