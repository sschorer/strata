import { describe, expect, it } from 'vitest';
import type { WorkerCommand, WorkerEvent } from './protocol.js';
import { workerRunner } from './runner.js';
import type { AnalysisThread } from './thread.js';

/**
 * The runner's job is the bookkeeping around a thread it cannot see into:
 * correlating answers to commands, forwarding the steps of a run as they
 * arrive, and — the part that matters most — leaving nothing hanging when the
 * thread dies. A stand-in thread is enough to hold it to all three.
 */

/** A thread that records what it was sent and answers when the test says so. */
function fakeThread() {
  const sent: WorkerCommand[] = [];
  const listeners = {
    message: [] as ((event: WorkerEvent) => void)[],
    error: [] as ((err: Error) => void)[],
    exit: [] as ((code: number) => void)[],
  };
  let terminated = 0;

  const thread: AnalysisThread = {
    postMessage: (command) => void sent.push(command),
    on: (event: string, listener: never) => {
      (listeners[event as keyof typeof listeners] as unknown[]).push(listener);
      return thread;
    },
    terminate: async () => {
      terminated++;
      for (const listener of listeners.exit) listener(0);
      return 0;
    },
  } as AnalysisThread;

  return {
    thread,
    sent,
    terminated: () => terminated,
    emit(event: WorkerEvent): void {
      for (const listener of listeners.message) listener(event);
    },
    crash(message: string): void {
      for (const listener of listeners.error) listener(new Error(message));
    },
    /** The id the runner made up for the nth command it sent. */
    id(n = 0): string {
      return sent[n]?.id ?? '';
    },
  };
}

function runnerOver(threads: AnalysisThread[]) {
  let spawned = 0;
  const runner = workerRunner({
    registry: { pluginsDir: '/plugins' },
    spawn: () => {
      const next = threads[spawned++];
      if (!next) throw new Error('spawned more threads than the test provided');
      return next;
    },
  });
  return { runner, spawned: () => spawned };
}

const options = { root: '/repo' };

describe('workerRunner', () => {
  it('starts no thread until there is something to run', () => {
    const fake = fakeThread();
    const { spawned } = runnerOver([fake.thread]);

    // A workbench nobody asks to analyse anything never loads a second copy of
    // every plugin.
    expect(spawned()).toBe(0);
  });

  it('answers a run with the report the thread sent back', async () => {
    const fake = fakeThread();
    const { runner } = runnerOver([fake.thread]);

    const running = runner.analyze(options, () => undefined);
    const report = { rev: 'abc123' } as never;
    fake.emit({ type: 'done', id: fake.id(), report });

    await expect(running).resolves.toBe(report);
    expect(fake.sent[0]).toMatchObject({ type: 'analyze', options });
  });

  it('forwards every step of a run as the thread reports it', async () => {
    const fake = fakeThread();
    const { runner } = runnerOver([fake.thread]);

    const steps: string[] = [];
    const running = runner.analyze(options, (p) => steps.push(p.stage));
    const id = fake.id();
    fake.emit({
      type: 'progress',
      id,
      progress: { stage: 'scanning', detail: null, completed: 1, total: 0 },
    });
    fake.emit({
      type: 'progress',
      id,
      progress: {
        stage: 'language',
        detail: 'language-typescript',
        completed: 2,
        total: 5,
      },
    });
    fake.emit({ type: 'done', id, report: { rev: 'abc123' } as never });
    await running;

    expect(steps).toEqual(['scanning', 'language']);
  });

  it('keeps two commands apart', async () => {
    const fake = fakeThread();
    const { runner } = runnerOver([fake.thread]);

    const first = runner.analyze({ root: '/one' }, () => undefined);
    const second = runner.analyze({ root: '/two' }, () => undefined);
    // Answered out of order: the id is what pairs a reply with its request.
    fake.emit({ type: 'done', id: fake.id(1), report: { rev: 'two' } as never });
    fake.emit({ type: 'done', id: fake.id(0), report: { rev: 'one' } as never });

    expect((await first).rev).toBe('one');
    expect((await second).rev).toBe('two');
  });

  it('raises what the thread reported as the failure', async () => {
    const fake = fakeThread();
    const { runner } = runnerOver([fake.thread]);

    const running = runner.analyze(options, () => undefined);
    fake.emit({ type: 'failed', id: fake.id(), message: 'not a repository' });

    await expect(running).rejects.toThrow('not a repository');
  });

  it('fails what a dead thread still owed instead of hanging', async () => {
    const fake = fakeThread();
    const { runner } = runnerOver([fake.thread, fakeThread().thread]);

    const running = runner.analyze(options, () => undefined);
    fake.crash('out of memory');

    // A caller waiting on a thread that is gone would otherwise wait forever.
    await expect(running).rejects.toThrow(/out of memory/);
  });

  it('starts a fresh thread for the next run after one dies', async () => {
    const first = fakeThread();
    const second = fakeThread();
    const { runner, spawned } = runnerOver([first.thread, second.thread]);

    await expect(
      (() => {
        const running = runner.analyze(options, () => undefined);
        first.crash('out of memory');
        return running;
      })(),
    ).rejects.toThrow();

    const running = runner.analyze(options, () => undefined);
    second.emit({ type: 'done', id: second.id(), report: { rev: 'ok' } as never });
    await running;

    expect(spawned()).toBe(2);
  });

  it('stops the thread on close and refuses anything after it', async () => {
    const fake = fakeThread();
    const { runner } = runnerOver([fake.thread]);
    const cleared = runner.clearCache();
    fake.emit({ type: 'done', id: fake.id() });
    await cleared;
    expect(fake.sent[0]?.type).toBe('clear-cache');

    await runner.close();

    expect(fake.terminated()).toBe(1);
    await expect(runner.analyze(options, () => undefined)).rejects.toThrow(
      /shut down/,
    );
  });
});
