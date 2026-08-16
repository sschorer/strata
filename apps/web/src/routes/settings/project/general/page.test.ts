import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysis } from '$lib/analysis';
import { projects, SELECTION_STORAGE_KEY } from '$lib/projects';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import Page from './+page.svelte';

/**
 * The route as the app mounts it: over the app-wide registry and the app-wide
 * config store, with nothing handed in.
 */

const strata = {
  id: 'strata',
  name: 'Strata',
  root: '/home/dev/workspace/strata',
  addedAt: '2026-08-01T09:00:00.000Z',
  lastAnalysis: null,
};

const config = {
  rev: 'main',
  historyLimit: 500,
  ignore: [],
  paths: [],
  languages: null,
  metrics: null,
  convention: null,
  rules: [],
};

let ui: ReturnType<typeof render>;

beforeEach(async () => {
  analysis.select('');
  localStorage.setItem(SELECTION_STORAGE_KEY, 'strata');
  stubApi({
    '/projects': { projects: [strata] },
    '/projects/strata/config': config,
  });
  await projects.reload();
});

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('project general settings page', () => {
  it('opens on the project the workbench is pointed at', async () => {
    ui = render(Page);

    await vi.waitFor(() => {
      const name = ui.container.querySelector<HTMLInputElement>(
        'input[name="name"]',
      );
      expect(name?.value).toBe('Strata');
    });

    const value = (field: string) =>
      ui.container.querySelector<HTMLInputElement>(`input[name="${field}"]`)
        ?.value;
    expect(value('root')).toBe('/home/dev/workspace/strata');
    expect(value('rev')).toBe('main');
    expect(value('historyLimit')).toBe('500');
  });
});
