import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projects, SELECTION_STORAGE_KEY } from '$lib/projects';
import { PROJECT_SECTIONS } from '$lib/settings';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import Page from './+page.svelte';

/**
 * The landing screen of the project scope: what is being configured, and the
 * sections it is divided into. It reads the app-wide registry, so the choice
 * is in place before the first mount.
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

describe('project settings page', () => {
  it('names the project the settings are scoped to', () => {
    ui = render(Page);

    const text = ui.container.textContent ?? '';
    expect(text).toContain('Project settings');
    expect(text).toContain('Strata');
    expect(text).toContain('/home/dev/workspace/strata');
  });

  it('lists every section with what it holds', () => {
    ui = render(Page);

    const text = ui.container.textContent ?? '';
    for (const section of PROJECT_SECTIONS) {
      expect(text).toContain(section.label);
      expect(text).toContain(section.description);
    }
  });

  it('links to the sections that are built, and to no other', () => {
    ui = render(Page);

    const built = PROJECT_SECTIONS.filter(
      (section) => section.status === 'ready',
    );
    expect(
      [...ui.container.querySelectorAll('a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(built.map((section) => section.href));
    expect(ui.container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(
      PROJECT_SECTIONS.length - built.length,
    );
  });
});
