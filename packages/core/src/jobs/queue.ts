import { randomUUID } from 'node:crypto';
import type { AnalysisProgress } from '../progress/index.js';
import type { AnalysisReport, AnalyzeOptions } from '../types.js';
import { requestKey } from './key.js';
import type {
  AnalysisJob,
  AnalysisRunner,
  JobListener,
  JobState,
  QueueOptions,
} from './types.js';

const DEFAULT_HISTORY = 20;

/** A job plus what the queue needs to run it and to answer for it afterwards. */
interface JobRecord {
  job: AnalysisJob;
  /** Digest of the request, so an identical one joins this job. */
  key: string;
  options: AnalyzeOptions;
  settled: Promise<AnalysisJob>;
  finish: (job: AnalysisJob) => void;
}

/**
 * The analysis queue: work is asked for here, runs one at a time, and can be
 * followed while it runs.
 *
 * Three things make it worth having. Analyses are **serialised**, because they
 * are CPU-bound and share one incremental cache, so two at once would be slower
 * than two in a row and would fight over the same database. Identical requests
 * are **one job**, so a double-clicked *Re-analyze* and two browsers open on the
 * same project all follow the same run. And a job **outlives the request that
 * asked for it**, so a caller can be handed an id straight away and collect the
 * report later — which is what turns a blocking button into a running state.
 *
 * Where the work actually happens is the runner's business: in this thread, or
 * in a worker that leaves the caller's event loop free to answer.
 */
export class AnalysisQueue {
  readonly #records = new Map<string, JobRecord>();
  readonly #listeners = new Map<string, Set<JobListener>>();
  readonly #history: number;
  /** Every task runs behind the one before it; this is the tail of that chain. */
  #chain: Promise<unknown> = Promise.resolve();
  #closed = false;

  constructor(
    private readonly runner: AnalysisRunner,
    options: QueueOptions = {},
  ) {
    this.#history = options.history ?? DEFAULT_HISTORY;
  }

  /**
   * Ask for a run. Returns immediately with the job — queued, or the live one
   * an identical request is already waiting on.
   *
   * Joining a run in flight is the point: it is what stops a second walk of the
   * same repository at the same revision from queueing behind the first. A
   * caller that wants a genuinely fresh look asks for a different run (another
   * revision, or `cache: false`), which is a different request and so a
   * different job.
   */
  submit(options: AnalyzeOptions): AnalysisJob {
    if (this.#closed) {
      throw new Error('The analysis queue is closed.');
    }

    const key = requestKey(options);
    const live = [...this.#records.values()].find(
      (r) => r.key === key && !isFinal(r.job.state),
    );
    if (live) return live.job;

    const id = randomUUID();
    let finish!: (job: AnalysisJob) => void;
    const settled = new Promise<AnalysisJob>((resolve) => {
      finish = resolve;
    });
    const record: JobRecord = {
      key,
      options,
      settled,
      finish,
      job: {
        id,
        root: options.root,
        state: 'queued',
        progress: null,
        queuedAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        report: null,
        error: null,
      },
    };
    this.#records.set(id, record);
    this.#chain = this.#chain.then(() => this.#run(record));
    return record.job;
  }

  /** One job, or `undefined` for an id this queue never had or has forgotten. */
  get(id: string): AnalysisJob | undefined {
    return this.#records.get(id)?.job;
  }

  /** Every job still remembered, oldest first. */
  list(): AnalysisJob[] {
    return [...this.#records.values()].map((r) => r.job);
  }

  /**
   * The job once it reaches a final state, or `undefined` for an id the queue
   * does not know. Call it in the same turn as `submit` — a job is remembered
   * for a while, but not forever.
   */
  settled(id: string): Promise<AnalysisJob | undefined> {
    return this.#records.get(id)?.settled ?? Promise.resolve(undefined);
  }

  /**
   * Follow a job. The listener is called on every change until the job settles;
   * the returned function stops it, and is safe to call more than once (and for
   * a job that was never there, which listens to nothing).
   */
  watch(id: string, listener: JobListener): () => void {
    const listeners = this.#listeners.get(id) ?? new Set<JobListener>();
    listeners.add(listener);
    this.#listeners.set(id, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(id);
    };
  }

  /**
   * Forget every cached result, behind whatever is running. A clear that landed
   * mid-run would pull rows out from under an analysis that had already counted
   * them as hits, so it waits its turn like a run does.
   */
  clearCache(): Promise<void> {
    const done = this.#chain.then(() => this.runner.clearCache());
    // One failure must not break the chain for everything queued behind it.
    this.#chain = done.catch(() => undefined);
    return done;
  }

  /**
   * Stop taking work and release the runner.
   *
   * A run in flight is abandoned rather than waited for: the cache is committed
   * plugin by plugin, so the next run picks up where this one got to, and a
   * shutdown that waited out a ten-minute analysis would be killed halfway
   * through it anyway.
   */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    for (const record of this.#records.values()) {
      if (record.job.state === 'queued') {
        this.#settle(record, 'failed', {
          error: 'The workbench shut down before this run started.',
        });
      }
    }
    await this.runner.close();
  }

  /** One job's turn on the chain. Never throws: the chain has to survive it. */
  async #run(record: JobRecord): Promise<void> {
    // `close()` fails everything still queued, so a shut-down queue finds
    // nothing left to start.
    if (record.job.state !== 'queued') return;

    this.#update(record, {
      state: 'running',
      startedAt: new Date().toISOString(),
    });
    try {
      const report = await this.runner.analyze(record.options, (progress) =>
        this.#report(record, progress),
      );
      this.#settle(record, 'succeeded', { report });
    } catch (err) {
      this.#settle(record, 'failed', { error: message(err) });
    }
  }

  /** A step of a run. Ignored once the job has settled (a late worker message). */
  #report(record: JobRecord, progress: AnalysisProgress): void {
    if (isFinal(record.job.state)) return;
    this.#update(record, { progress });
  }

  #settle(
    record: JobRecord,
    state: Extract<JobState, 'succeeded' | 'failed'>,
    outcome: { report?: AnalysisReport; error?: string },
  ): void {
    this.#update(record, {
      state,
      finishedAt: new Date().toISOString(),
      report: outcome.report ?? null,
      error: outcome.error ?? null,
    });
    record.finish(record.job);
    // Every reader has just been handed the final state; there is nothing left
    // for them to hear.
    this.#listeners.delete(record.job.id);
    this.#prune();
  }

  /**
   * Replace the job with a new object rather than editing the one in place:
   * whoever is holding a snapshot — a listener mid-serialisation, a reply being
   * written — is holding what they were given, not a moving target.
   */
  #update(record: JobRecord, changes: Partial<AnalysisJob>): void {
    record.job = { ...record.job, ...changes };
    for (const listener of this.#listeners.get(record.job.id) ?? []) {
      try {
        listener(record.job);
      } catch {
        // A reader that throws is its own problem; the run carries on.
      }
    }
  }

  /** Keep the last `history` settled jobs; live ones are never dropped. */
  #prune(): void {
    const settled = [...this.#records.values()].filter((r) =>
      isFinal(r.job.state),
    );
    for (const record of settled.slice(0, settled.length - this.#history)) {
      this.#records.delete(record.job.id);
      this.#listeners.delete(record.job.id);
    }
  }
}

function isFinal(state: JobState): boolean {
  return state === 'succeeded' || state === 'failed';
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
