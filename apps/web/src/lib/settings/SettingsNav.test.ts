import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '$lib/api';
import { ProjectsStore, SELECTION_STORAGE_KEY } from '$lib/projects';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import SettingsNav from './SettingsNav.svelte';
import { PROJECT_SECTIONS } from './sections';

/**
 * The rail in settings mode. Each test gets its own registry store — the nav
 * loads it itself, because in settings mode the switcher that usually does is
 * not on screen.
 */

const strata: Project = {
  id: 'strata',
  name: 'Strata',
  root: '/home/dev/workspace/strata',
  addedAt: '2026-08-01T09:00:00.000Z',
  lastAnalysis: null,
};

const link = (ui: ReturnType<typeof render>, text: string) =>
  [...ui.container.querySelectorAll('a, span[aria-disabled]')].find((element) =>
    element.textContent?.trim().startsWith(text),
  );

/** Mount the nav over a registry, and let the project's name arrive. */
async function mount(
  props: { scope: 'project' | 'app'; pathname: string; orientation?: 'row' },
  registered: Project[] = [strata],
) {
  // The workbench comes back to the project it was on; the nav reads whichever
  // one that is, exactly as the switcher it replaces would.
  const first = registered[0];
  if (first) localStorage.setItem(SELECTION_STORAGE_KEY, first.id);
  stubApi({ '/projects': { projects: registered } });
  const projects = new ProjectsStore();
  const ui = render(SettingsNav, { ...props, projects });

  await vi.waitFor(() => {
    expect(projects.status).toBe('ready');
  });
  return ui;
}

let ui: ReturnType<typeof render>;

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('SettingsNav', () => {
  it('offers the way back to the workbench', async () => {
    ui = await mount({ scope: 'project', pathname: '/settings/project' });

    expect(link(ui, 'Back to workbench')?.getAttribute('href')).toBe('/');
  });

  it('scopes the title to the project the workbench is on', async () => {
    ui = await mount({ scope: 'project', pathname: '/settings/project' });

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('Strata');
    });
    const text = ui.container.textContent ?? '';
    expect(text).toContain('Project settings');
    expect(text).toContain('/home/dev/workspace/strata');
  });

  it('scopes the app settings to the workbench, with no root behind them', async () => {
    ui = await mount({ scope: 'app', pathname: '/settings/app' });

    const text = ui.container.textContent ?? '';
    expect(text).toContain('App settings');
    expect(text).toContain('This workbench');
    expect(text).not.toContain('/home/dev/workspace/strata');
  });

  it('says when there is no project to configure', async () => {
    ui = await mount({ scope: 'project', pathname: '/settings/project' }, []);

    expect(ui.container.textContent).toContain('No project selected');
  });

  it('lists the sections of the scope it is in, and only those', async () => {
    ui = await mount({ scope: 'project', pathname: '/settings/project' });

    const text = ui.container.textContent ?? '';
    for (const section of PROJECT_SECTIONS) {
      expect(text).toContain(section.label);
    }
    expect(text).not.toContain('AI providers');
  });

  it('shows a section that is not built yet without linking to it', async () => {
    ui = await mount({ scope: 'project', pathname: '/settings/project' });

    const general = link(ui, 'General');
    expect(general?.tagName).toBe('SPAN');
    expect(general?.getAttribute('aria-disabled')).toBe('true');
  });

  it('lays the same two things across on a narrow screen', async () => {
    ui = await mount({
      scope: 'app',
      pathname: '/settings/app',
      orientation: 'row',
    });

    const text = ui.container.textContent ?? '';
    expect(text).toContain('Back to workbench');
    expect(text).toContain('AI providers');
    // The scope's heading is the rail's; the strip has no room for it.
    expect(text).not.toContain('This workbench');
  });
});
