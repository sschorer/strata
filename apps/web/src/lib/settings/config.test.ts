import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectConfig } from '$lib/api';
import { stubApi } from '$lib/test/api';
import { ProjectConfigStore } from './config.svelte';

/** The open project's config against a stubbed API. */

const stored: ProjectConfig = {
  rev: 'HEAD',
  historyLimit: null,
  ignore: [],
  paths: [],
  languages: null,
  metrics: null,
  convention: null,
  rules: [],
};

const kernel: ProjectConfig = { ...stored, rev: 'main', historyLimit: 500 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('project config store', () => {
  it('reads the config of the project it is given', async () => {
    stubApi({ '/projects/strata/config': stored });
    const store = new ProjectConfigStore();

    await store.reload('strata');

    expect(store.status).toBe('ready');
    expect(store.projectId).toBe('strata');
    expect(store.config).toEqual(stored);
  });

  it('loads once per project', async () => {
    const fetchMock = stubApi({ '/projects/strata/config': stored });
    const store = new ProjectConfigStore();

    store.load('strata');
    store.load('strata');
    await vi.waitFor(() => {
      expect(store.status).toBe('ready');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops what it holds when the workbench moves to another project', async () => {
    stubApi({
      '/projects/strata/config': stored,
      '/projects/kernel/config': kernel,
    });
    const store = new ProjectConfigStore();
    await store.reload('strata');

    store.load('kernel');
    // Mid-flight the old project's config is already gone: showing it under
    // the new project's name would be worse than showing nothing.
    expect(store.config).toBeNull();
    await vi.waitFor(() => {
      expect(store.status).toBe('ready');
    });

    expect(store.projectId).toBe('kernel');
    expect(store.config?.rev).toBe('main');
  });

  it('holds what the server kept, not what was sent', async () => {
    stubApi({
      '/projects/strata/config': stored,
      // The server normalises on the way in; its answer is the config.
      'PATCH /projects/strata/config': { ...stored, rev: 'main' },
    });
    const store = new ProjectConfigStore();
    await store.reload('strata');

    const saved = await store.save('strata', { rev: '  main  ' });

    expect(saved.rev).toBe('main');
    expect(store.config?.rev).toBe('main');
  });

  it('leaves what it holds alone when a save is refused', async () => {
    stubApi({
      '/projects/strata/config': stored,
      'PATCH /projects/strata/config': Response.json(
        { message: 'The revision cannot be blank.' },
        { status: 400 },
      ),
    });
    const store = new ProjectConfigStore();
    await store.reload('strata');

    await expect(store.save('strata', { rev: ' ' })).rejects.toThrow(
      'cannot be blank',
    );
    expect(store.config).toEqual(stored);
    expect(store.status).toBe('ready');
  });

  it('surfaces a config it cannot read', async () => {
    stubApi({});
    const store = new ProjectConfigStore();

    await store.reload('gone');

    expect(store.status).toBe('error');
    expect(store.error).toBeTruthy();
    expect(store.config).toBeNull();
  });
});
