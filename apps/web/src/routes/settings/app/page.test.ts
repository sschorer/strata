import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projects, SELECTION_STORAGE_KEY } from '$lib/projects';
import { APP_SECTIONS } from '$lib/settings';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import Page from './+page.svelte';

/**
 * The landing screen of the app scope. A project is open on purpose: these
 * settings hold for the workbench, so the screen must not describe itself
 * with whichever repository happens to be selected.
 */

const strata = {
  id: 'strata',
  name: 'Strata',
  root: '/home/dev/workspace/strata',
  addedAt: '2026-08-01T09:00:00.000Z',
  lastAnalysis: null,
};

let ui: ReturnType<typeof render>;

beforeEach(async () => {
  localStorage.setItem(SELECTION_STORAGE_KEY, 'strata');
  stubApi({ '/projects': { projects: [strata] } });
  await projects.reload();
});

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('app settings page', () => {
  it('scopes itself to the workbench, not to the open project', () => {
    ui = render(Page);

    const text = ui.container.textContent ?? '';
    expect(text).toContain('App settings');
    expect(text).toContain('every project');
    expect(text).not.toContain('/home/dev/workspace/strata');
  });

  it('lists every section with what it holds', () => {
    ui = render(Page);

    const text = ui.container.textContent ?? '';
    for (const section of APP_SECTIONS) {
      expect(text).toContain(section.label);
      expect(text).toContain(section.description);
    }
  });

  it('links to no section that is not built yet', () => {
    ui = render(Page);

    expect(ui.container.querySelectorAll('a')).toHaveLength(0);
    expect(ui.container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(
      APP_SECTIONS.length,
    );
  });
});
