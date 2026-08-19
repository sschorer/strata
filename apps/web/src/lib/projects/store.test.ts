import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysis, ROOT_STORAGE_KEY } from '$lib/analysis';
import type { Project } from '$lib/api';
import { runRoutes, stubApi } from '$lib/test/api';
import { noCommits } from '$lib/test/commits';
import { SELECTION_STORAGE_KEY } from './selection';
import { ProjectsStore } from './store.svelte';

/**
 * The registry store against a stubbed API. The analysis store it points is
 * the app's single instance, so each test starts by clearing it.
 */

const strata: Project = {
  id: 'strata',
  name: 'Strata',
  root: '/home/dev/workspace/strata',
  addedAt: '2026-08-01T09:00:00.000Z',
  lastAnalysis: {
    rev: '7f80d51cafe',
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: '2026-08-16T09:00:00.000Z',
  },
};

const kernel: Project = {
  id: 'kernel',
  name: 'Kernel',
  root: '/home/dev/workspace/kernel',
  addedAt: '2026-08-04T09:00:00.000Z',
  lastAnalysis: null,
};

const registry = { projects: [strata, kernel] };

const report = {
  rev: 'abc12345678',
  run: {
    branch: 'main',
    files: 12,
    durationMs: 300,
    finishedAt: '2026-08-16T11:00:00.000Z',
  },
  languages: {},
  metrics: [],
  commits: [],
  commitAnalytics: noCommits(),
  cache: {
    enabled: false,
    hits: 0,
    misses: 0,
    runHits: 0,
    runMisses: 0,
    writes: 0,
  },
};

async function loaded(routes: Record<string, unknown> = {}) {
  stubApi({ '/projects': registry, ...routes });
  const store = new ProjectsStore();
  await store.reload();
  return store;
}

beforeEach(() => {
  analysis.select('');
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('projects store', () => {
  it('lists what the registry holds', async () => {
    const store = await loaded();

    expect(store.status).toBe('ready');
    expect(store.projects.map((project) => project.id)).toEqual([
      'strata',
      'kernel',
    ]);
    // Nothing to come back to on a first visit.
    expect(store.current).toBeNull();
  });

  it('points the workbench at the project it is given', async () => {
    const store = await loaded();

    store.select('kernel');

    expect(store.current?.name).toBe('Kernel');
    expect(analysis.root).toBe('/home/dev/workspace/kernel');
    expect(localStorage.getItem(SELECTION_STORAGE_KEY)).toBe('kernel');
  });

  it('drops a report that describes the project just left', async () => {
    const store = await loaded(runRoutes(report));
    store.select('strata');
    await analysis.run();
    expect(analysis.report).not.toBeNull();

    store.select('kernel');

    expect(analysis.report).toBeNull();
    expect(analysis.status).toBe('idle');
  });

  it('comes back to the project it was on', async () => {
    localStorage.setItem(SELECTION_STORAGE_KEY, 'kernel');

    const store = await loaded();

    expect(store.current?.id).toBe('kernel');
    expect(analysis.root).toBe('/home/dev/workspace/kernel');
  });

  it('adopts the project registered for the remembered repository', async () => {
    // Nothing was selected — the path a run left behind names the project.
    localStorage.setItem(ROOT_STORAGE_KEY, '/home/dev/workspace/strata');

    const store = await loaded();

    expect(store.current?.id).toBe('strata');
  });

  it('registers a repository and lands on it', async () => {
    const added = {
      id: 'demo',
      name: 'Demo',
      root: '/home/dev/workspace/demo',
      addedAt: '2026-08-16T12:00:00.000Z',
      lastAnalysis: null,
    };
    const store = await loaded({ 'POST /projects': added });

    await store.add({ name: 'Demo', root: '/home/dev/workspace/demo/src' });

    expect(store.projects.map((project) => project.id)).toContain('demo');
    expect(store.current?.id).toBe('demo');
    expect(analysis.root).toBe('/home/dev/workspace/demo');
  });

  it('reports a root that is already registered instead of adding it', async () => {
    const store = await loaded({
      'POST /projects': Response.json(
        { message: '/home/dev/workspace/strata is already registered.' },
        { status: 409 },
      ),
    });

    await expect(
      store.add({ name: 'Again', root: '/home/dev/workspace/strata' }),
    ).rejects.toThrow('already registered');
    expect(store.projects).toHaveLength(2);
  });

  it('renames a project to what the registry kept', async () => {
    const store = await loaded({
      'PATCH /projects/strata': { ...strata, name: 'Strata core' },
    });
    store.select('strata');

    await store.update('strata', { name: 'Strata core' });

    expect(store.current?.name).toBe('Strata core');
    // A rename is identity only: the repository it points at is untouched.
    expect(analysis.root).toBe('/home/dev/workspace/strata');
  });

  it('re-points the workbench when the selected project moves', async () => {
    const store = await loaded({
      'PATCH /projects/strata': { ...strata, root: '/mnt/repos/strata' },
    });
    store.select('strata');

    await store.update('strata', { root: '/mnt/repos/strata' });

    expect(store.current?.root).toBe('/mnt/repos/strata');
    expect(analysis.root).toBe('/mnt/repos/strata');
  });

  it('removes the selected project and points the workbench at nothing', async () => {
    const store = await loaded({
      'DELETE /projects/kernel': { removed: true },
    });
    store.select('kernel');

    await store.remove('kernel');

    expect(store.projects.map((project) => project.id)).toEqual(['strata']);
    expect(store.current).toBeNull();
    expect(analysis.root).toBe('');
    expect(localStorage.getItem(SELECTION_STORAGE_KEY)).toBeNull();
  });

  it('leaves the selection alone when another project is removed', async () => {
    const store = await loaded({
      'DELETE /projects/kernel': { removed: true },
    });
    store.select('strata');

    await store.remove('kernel');

    expect(store.current?.id).toBe('strata');
    expect(analysis.root).toBe('/home/dev/workspace/strata');
  });

  it('folds a finished run into the row it belongs to', async () => {
    const store = await loaded();
    store.select('kernel');

    store.record(report);

    expect(store.current?.lastAnalysis).toEqual({
      rev: 'abc12345678',
      ...report.run,
    });
    // The project that did not run keeps what it had.
    expect(store.projects[0]?.lastAnalysis?.rev).toBe('7f80d51cafe');
  });

  it('surfaces a server that is not there', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const store = new ProjectsStore();
    await store.reload();

    expect(store.status).toBe('error');
    expect(store.error).toBeTruthy();
    expect(store.projects).toHaveLength(0);
  });
});
