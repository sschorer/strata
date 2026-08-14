import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysis } from './store.svelte';
import { ROOT_STORAGE_KEY } from './root-storage';

const report = {
  rev: 'abc123',
  languages: {},
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
    const fetchMock = vi.fn(async () => Response.json(report));
    vi.stubGlobal('fetch', fetchMock);

    await analysis.run('  /repo/strata  ');

    expect(analysis.status).toBe('ready');
    expect(analysis.report?.rev).toBe('abc123');
    expect(analysis.root).toBe('/repo/strata');
    expect(localStorage.getItem(ROOT_STORAGE_KEY)).toBe('/repo/strata');

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toEqual({ root: '/repo/strata' });
  });

  it('surfaces a failed run without dropping the last good report', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: 'not a repository' }, { status: 400 })),
    );

    await analysis.run('/not/a/repo');

    expect(analysis.status).toBe('error');
    expect(analysis.error).toBe('not a repository');
    // The store is the app's single instance: the report the previous run
    // loaded has to stay on screen behind the error.
    expect(analysis.report?.rev).toBe('abc123');
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
    const slow = Response.json({ ...report, rev: 'slow' });
    const fast = Response.json({ ...report, rev: 'fast' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { root: string };
        if (body.root !== '/slow') return fast;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return slow;
      }),
    );

    const first = analysis.run('/slow');
    const second = analysis.run('/fast');
    await Promise.all([first, second]);

    expect(analysis.report?.rev).toBe('fast');
    expect(analysis.status).toBe('ready');
  });
});
