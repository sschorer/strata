import { describe, expect, it } from 'vitest';
import { crossLanguageGraph } from '../graph/index.js';
import type { AnalysisReport, AnalyzeOptions } from '../types.js';
import { AnalysisQueue } from './queue.js';
import type { AnalysisJob, AnalysisRunner } from './types.js';

/**
 * The queue is what turns a blocking analysis into something a caller can be
 * handed and collect later. What it promises: one run at a time, identical
 * requests joined into one job, every step visible while it happens, and a
 * finished job that outlives the request that asked for it.
 */

function reportFor(rev: string): AnalysisReport {
  return {
    rev,
    run: {
      branch: 'main',
      files: 1,
      durationMs: 1,
      finishedAt: '2026-08-15T10:00:00.000Z',
    },
    languages: {},
    dependencies: crossLanguageGraph([]),
    metrics: [],
    commits: [],
    commitAnalytics: {
      total: 0,
      valid: 0,
      invalid: 0,
      validRate: 0,
      breaking: 0,
      types: [],
      scopes: [],
      weeks: [],
    },
    cache: {
      enabled: false,
      hits: 0,
      misses: 0,
      runHits: 0,
      runMisses: 0,
      writes: 0,
    },
  };
}

/** A runner whose every run is held open until the test lets it finish. */
function controllable() {
  const calls: AnalyzeOptions[] = [];
  const waiting: {
    options: AnalyzeOptions;
    report: (report: AnalysisReport) => void;
    fail: (message: string) => void;
    step: (detail: string) => void;
  }[] = [];
  let cleared = 0;
  let closed = 0;

  const runner: AnalysisRunner = {
    analyze: (options, onProgress) => {
      calls.push(options);
      return new Promise<AnalysisReport>((resolve, reject) => {
        waiting.push({
          options,
          report: resolve,
          fail: (message) => reject(new Error(message)),
          step: (detail) =>
            onProgress({
              stage: 'language',
              detail,
              completed: 2,
              total: 5,
            }),
        });
      });
    },
    clearCache: async () => {
      cleared++;
    },
    close: async () => {
      closed++;
    },
  };

  return {
    runner,
    calls,
    waiting,
    cleared: () => cleared,
    closed: () => closed,
    /** Let whatever is running finish, then let the chain catch up. */
    async finish(rev = 'abc123'): Promise<void> {
      waiting.shift()?.report(reportFor(rev));
      await settleMicrotasks();
    },
  };
}

/** The queue advances on microtasks; give them a turn. */
async function settleMicrotasks(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

const options = (root: string, rev?: string): AnalyzeOptions => ({ root, rev });

describe('AnalysisQueue', () => {
  it('hands back a queued job straight away and runs it behind the request', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);

    const job = queue.submit(options('/repo'));

    expect(job).toMatchObject({ root: '/repo', state: 'queued', report: null });
    await settleMicrotasks();
    expect(queue.get(job.id)?.state).toBe('running');

    await backing.finish('abc123');
    expect(queue.get(job.id)).toMatchObject({
      state: 'succeeded',
      report: { rev: 'abc123' },
      error: null,
    });
  });

  it('runs one analysis at a time', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);

    queue.submit(options('/one'));
    const second = queue.submit(options('/two'));
    await settleMicrotasks();

    // The second is accepted, not started: they share a cache and a CPU.
    expect(backing.calls.map((c) => c.root)).toEqual(['/one']);
    expect(queue.get(second.id)?.state).toBe('queued');

    await backing.finish();
    expect(backing.calls.map((c) => c.root)).toEqual(['/one', '/two']);
  });

  it('joins an identical request to the run already in flight', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);

    const first = queue.submit(options('/repo'));
    const again = queue.submit(options('/repo'));

    expect(again.id).toBe(first.id);
    await settleMicrotasks();
    expect(backing.calls).toHaveLength(1);
  });

  it('keeps a request that asks something else apart', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);

    const head = queue.submit(options('/repo'));
    const tag = queue.submit(options('/repo', 'v1.0.0'));

    expect(tag.id).not.toBe(head.id);
    expect(queue.list()).toHaveLength(2);
  });

  it('runs a repeat of a request that has already finished', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);

    const first = queue.submit(options('/repo'));
    await settleMicrotasks();
    await backing.finish();

    // Joining is about work in flight; a finished run is history, and asking
    // again means asking again.
    const second = queue.submit(options('/repo'));
    expect(second.id).not.toBe(first.id);
  });

  it('reports every step of a run to whoever is watching', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);
    const job = queue.submit(options('/repo'));

    const seen: AnalysisJob[] = [];
    queue.watch(job.id, (update) => seen.push(update));
    await settleMicrotasks();
    backing.waiting[0]?.step('language-typescript');
    await backing.finish();

    expect(seen.map((j) => j.state)).toEqual([
      'running',
      'running',
      'succeeded',
    ]);
    expect(seen[1]?.progress).toMatchObject({
      stage: 'language',
      detail: 'language-typescript',
      completed: 2,
      total: 5,
    });
  });

  it('stops reporting to a watcher that unsubscribed', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);
    const job = queue.submit(options('/repo'));

    const seen: string[] = [];
    const stop = queue.watch(job.id, (update) => seen.push(update.state));
    await settleMicrotasks();
    stop();
    await backing.finish();

    expect(seen).toEqual(['running']);
  });

  it('turns a run that threw into a failed job rather than an unhandled error', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);
    const job = queue.submit(options('/repo'));
    await settleMicrotasks();

    backing.waiting.shift()?.fail('not a git repository');
    await settleMicrotasks();

    expect(queue.get(job.id)).toMatchObject({
      state: 'failed',
      error: 'not a git repository',
      report: null,
    });
  });

  it('carries on after a failed run', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);
    queue.submit(options('/broken'));
    const next = queue.submit(options('/fine'));
    await settleMicrotasks();

    backing.waiting.shift()?.fail('not a git repository');
    await settleMicrotasks();
    await backing.finish();

    expect(queue.get(next.id)?.state).toBe('succeeded');
  });

  it('settles for whoever asked, whether it worked or not', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);
    const job = queue.submit(options('/repo'));
    const settled = queue.settled(job.id);
    await settleMicrotasks();

    await backing.finish('abc123');

    expect((await settled)?.report?.rev).toBe('abc123');
    expect(await queue.settled('nobody')).toBeUndefined();
  });

  it('forgets the oldest finished jobs and keeps every live one', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner, { history: 2 });

    const ids: string[] = [];
    for (const root of ['/a', '/b', '/c']) {
      ids.push(queue.submit(options(root)).id);
      await settleMicrotasks();
      await backing.finish();
    }
    const live = queue.submit(options('/d'));
    await settleMicrotasks();

    expect(queue.get(ids[0] ?? '')).toBeUndefined();
    expect(queue.get(ids[2] ?? '')?.state).toBe('succeeded');
    expect(queue.get(live.id)?.state).toBe('running');
  });

  it('clears the cache behind whatever is running', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);
    queue.submit(options('/repo'));
    await settleMicrotasks();

    const cleared = queue.clearCache();
    await settleMicrotasks();
    // A clear landing mid-run would drop rows the run had counted as hits.
    expect(backing.cleared()).toBe(0);

    await backing.finish();
    await cleared;
    expect(backing.cleared()).toBe(1);
  });

  it('fails what never started when the workbench shuts down', async () => {
    const backing = controllable();
    const queue = new AnalysisQueue(backing.runner);
    queue.submit(options('/running'));
    const queued = queue.submit(options('/queued'));
    await settleMicrotasks();

    await queue.close();

    expect(queue.get(queued.id)).toMatchObject({ state: 'failed' });
    expect(queue.get(queued.id)?.error).toContain('shut down');
    expect(backing.closed()).toBe(1);
    expect(() => queue.submit(options('/late'))).toThrow(/closed/);
  });
});
