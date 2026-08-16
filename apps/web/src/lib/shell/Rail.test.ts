import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysis } from '$lib/analysis';
import { render } from '$lib/test/render';
import Rail from './Rail.svelte';

const pluginsResponse = {
  directory: '/home/dev/.strata/plugins',
  plugins: [
    { id: 'language-typescript', name: 'TypeScript', kind: 'language' },
    { id: 'git-hotspots', name: 'Hotspots', kind: 'metric' },
    { id: 'git-coupling', name: 'Coupling', kind: 'metric' },
  ],
  failures: [],
};

const entry = (ui: ReturnType<typeof render>, label: string) =>
  [...ui.container.querySelectorAll('a, span[aria-disabled]')].find(
    (element) => element.textContent?.trim().startsWith(label),
  );

let ui: ReturnType<typeof render>;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(pluginsResponse)),
  );
});

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Rail', () => {
  it('lists the analysis screens and the settings scopes', () => {
    ui = render(Rail, { pathname: '/hotspots' });

    const text = ui.container.textContent ?? '';
    for (const label of [
      'Overview',
      'Hotspots',
      'Dependencies',
      'Commits',
      'Dead code',
      'Project settings',
      'App settings',
    ]) {
      expect(text).toContain(label);
    }
  });

  it('marks the screen the app is on', () => {
    ui = render(Rail, { pathname: '/graph' });

    expect(entry(ui, 'Dependencies')?.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(entry(ui, 'Hotspots')?.getAttribute('aria-current')).toBeNull();
  });

  it('shows a screen that is not built yet without linking to it', () => {
    ui = render(Rail, { pathname: '/hotspots' });

    const commits = entry(ui, 'Commits');
    expect(commits?.tagName).toBe('SPAN');
    expect(commits?.getAttribute('aria-disabled')).toBe('true');
  });

  it('counts the plugins the workbench loaded', async () => {
    ui = render(Rail, { pathname: '/' });

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('plugins loaded');
    });
    expect(ui.container.textContent).toContain('3');
  });

  it('names the repository the workbench is pointed at', () => {
    analysis.root = '/home/dev/workspace/strata';
    ui = render(Rail, { pathname: '/' });

    expect(ui.container.textContent).toContain('strata');
    expect(ui.container.textContent).toContain('/home/dev/workspace/strata');
  });
});
