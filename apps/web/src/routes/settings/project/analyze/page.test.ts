import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysis } from '$lib/analysis';
import { projects, SELECTION_STORAGE_KEY } from '$lib/projects';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import Page from './+page.svelte';

/**
 * The route as the app mounts it: over the app-wide registry, config and
 * plugin stores, with nothing handed in.
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
    '/plugins': { directory: '/plugins', plugins: [], failures: [] },
  });
  await projects.reload();
});

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('project analyze settings page', () => {
  it('opens on the project the workbench is pointed at', async () => {
    ui = render(Page);

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('/home/dev/workspace/strata');
    });
    const text = ui.container.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('Last 500 commits');
    expect(
      [...ui.container.querySelectorAll('button')].some((element) =>
        element.textContent?.includes('Run analysis'),
      ),
    ).toBe(true);
  });
});
