import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginsStore } from './store.svelte';

const response = {
  directory: '/home/dev/.strata/plugins',
  plugins: [
    { id: 'language-typescript', name: 'TypeScript', kind: 'language' },
    { id: 'git-hotspots', name: 'Hotspots', kind: 'metric' },
  ],
  failures: [
    { manifestPath: '/plugins/broken', source: 'user', error: 'no entry' },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('plugins store', () => {
  it('counts what loaded and what was skipped', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(response)),
    );

    const store = new PluginsStore();
    expect(store.count).toBeNull();

    await store.reload();

    expect(store.status).toBe('ready');
    expect(store.count).toBe(2);
    expect(store.failures).toBe(1);
  });

  it('loads once however many views ask for it', async () => {
    const fetchMock = vi.fn(async () => Response.json(response));
    vi.stubGlobal('fetch', fetchMock);

    const store = new PluginsStore();
    store.load();
    store.load();
    await vi.waitFor(() => {
      expect(store.status).toBe('ready');
    });
    store.load();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a server that is not there', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    const store = new PluginsStore();
    await store.reload();

    expect(store.status).toBe('error');
    expect(store.error).toBeTruthy();
    expect(store.count).toBeNull();
  });
});
