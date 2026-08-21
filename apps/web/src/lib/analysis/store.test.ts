import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runRoutes, stubApi } from '$lib/test/api';
import { dependenciesOf } from '$lib/test/graph';
import { analysis } from './store.svelte';
import { ROOT_STORAGE_KEY } from './root-storage';

/**
 * The store is what the whole app reads a run through. Since a run is a job on
 * the server rather than a request left open, it has two jobs of its own: keep
 * the screens told about where the run has got to, and make sure the answer
 * that lands belongs to the repository the workbench is still pointed at.
 */

const report = {
  rev: 'abc123',
  languages: {},
  dependencies: dependenciesOf(),
  metrics: [],
  commits: [],
  cache: {
    enabled: false,
    hits: 0,
    misses: 0,
    runHits: 0,
    runMisses: 0,
    writes: 0,
  },
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('analysis store', () => {
  it('runs the analysis and remembers the repo path', async () => {
    const fetchMock = stubApi(runRoutes(report));

    await analysis.run('  /repo/strata  ');

    expect(analysis.status).toBe('ready');
    expect(analysis.report?.rev).toBe('abc123');
    expect(analysis.root).toBe('/repo/strata');
    expect(localStorage.getItem(ROOT_STORAGE_KEY)).toBe('/repo/strata');

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    // It takes the job rather than holding the request open for the run.
    expect(JSON.parse(String(init.body))).toEqual({
      root: '/repo/strata',
      wait: false,
    });
  });

  it('reports where the run has got to, and stops when it is over', async () => {
    const job = {
      id: 'run-1',
      root: '/repo/strata',
      state: 'running',
      progress: { stage: 'scanning', detail: null, completed: 1, total: 0 },
      queuedAt: '2026-08-15T10:00:00.000Z',
      startedAt: '2026-08-15T10:00:00.000Z',
      finishedAt: null,
      report: null,
      error: null,
    };
    // The run is held open after its first step, which is where a *Re-analyze*
    // button spends most of its life.
    let release = (): void => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const encoder = new TextEncoder();
    const frame = (state: string, body: unknown) =>
      encoder.encode(`event: ${state}\ndata: ${JSON.stringify(body)}\n\n`);

    stubApi({
      'POST /analyze': { job: { ...job, state: 'queued', progress: null } },
      '/jobs/run-1/events': () =>
        new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(frame('running', job));
              await held;
              controller.enqueue(
                frame('succeeded', {
                  ...job,
                  state: 'succeeded',
                  progress: null,
                  report,
                }),
              );
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    });

    const running = analysis.run('/repo/strata');
    await vi.waitFor(() => {
      expect(analysis.progress?.stage).toBe('scanning');
    });
    release();
    await running;

    expect(analysis.status).toBe('ready');
    // Nothing is running, so there is nothing to report about it.
    expect(analysis.progress).toBeNull();
  });

  it('surfaces a run the server refused without dropping the last good report', async () => {
    stubApi({
      'POST /analyze': Response.json(
        { message: 'not a repository' },
        { status: 400 },
      ),
    });

    await analysis.run('/not/a/repo');

    expect(analysis.status).toBe('error');
    expect(analysis.error).toBe('not a repository');
    // The store is the app's single instance: the report the previous run
    // loaded has to stay on screen behind the error.
    expect(analysis.report?.rev).toBe('abc123');
  });

  it('surfaces a run that was accepted and then failed', async () => {
    const failed = {
      id: 'run-1',
      root: '/repo/strata',
      state: 'failed',
      progress: null,
      queuedAt: '2026-08-15T10:00:00.000Z',
      startedAt: '2026-08-15T10:00:00.000Z',
      finishedAt: '2026-08-15T10:00:01.000Z',
      report: null,
      error: 'the plugin threw',
    };
    stubApi({
      'POST /analyze': { job: { ...failed, state: 'queued' } },
      '/jobs/run-1/events': () =>
        new Response(`event: failed\ndata: ${JSON.stringify(failed)}\n\n`, {
          headers: { 'content-type': 'text/event-stream' },
        }),
    });

    await analysis.run('/repo/strata');

    // The request worked; the analysis did not, and that is the news.
    expect(analysis.status).toBe('error');
    expect(analysis.error).toBe('the plugin threw');
  });

  it('asks the server what happened when the stream never opens', async () => {
    const done = {
      id: 'run-1',
      root: '/repo/strata',
      state: 'succeeded',
      progress: null,
      queuedAt: '2026-08-15T10:00:00.000Z',
      startedAt: '2026-08-15T10:00:00.000Z',
      finishedAt: '2026-08-15T10:00:02.000Z',
      report: { ...report, rev: 'polled' },
      error: null,
    };
    stubApi({
      'POST /analyze': { job: { ...done, state: 'queued', report: null } },
      // A proxy that will not carry an event stream, or a connection that
      // dropped: the run is fine, and asking is how the workbench finds out.
      '/jobs/run-1/events': Response.json({ message: 'no' }, { status: 502 }),
      '/jobs/run-1': { job: done },
    });

    await analysis.run('/repo/strata');

    expect(analysis.status).toBe('ready');
    expect(analysis.report?.rev).toBe('polled');
  });

  it('refuses an empty path instead of calling the server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await analysis.run('   ');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(analysis.status).toBe('error');
    expect(analysis.error).toContain('absolute path');
  });

  it('lets the newest run win when two overlap', async () => {
    // The slow run resolves last; its result must not replace the newer one.
    const slow = runRoutes({ ...report, rev: 'slow' }, 'slow-run');
    const fast = runRoutes({ ...report, rev: 'fast' }, 'fast-run');
    stubApi({
      ...slow,
      ...fast,
      'POST /analyze': (body: unknown) => {
        const { root } = body as { root: string };
        const id = root === '/slow' ? 'slow-run' : 'fast-run';
        return { job: { id, root, state: 'queued' } };
      },
      '/jobs/slow-run/events': async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return (slow['/jobs/slow-run/events'] as () => Response)();
      },
    });

    const first = analysis.run('/slow');
    const second = analysis.run('/fast');
    await Promise.all([first, second]);

    expect(analysis.report?.rev).toBe('fast');
    expect(analysis.status).toBe('ready');
  });
});
