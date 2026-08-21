import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projects, SELECTION_STORAGE_KEY } from '$lib/projects';
import { failedRunRoutes, runRoutes, stubApi } from '$lib/test/api';
import { dependenciesOf } from '$lib/test/graph';
import { render } from '$lib/test/render';
import Header from './Header.svelte';

/**
 * The header reads the app-wide analysis store and the app-wide registry, both
 * of which are single instances and survive between the tests below — so the
 * first test here is the one that runs before any repository has been named,
 * and the last is the one that registers a project.
 */

const report = {
  rev: '982eb56cafe1234',
  run: {
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: new Date().toISOString(),
  },
  languages: {},
  dependencies: dependenciesOf(),
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

const strata = {
  id: 'strata',
  name: 'Strata workbench',
  root: '/home/dev/workspace/strata',
  addedAt: '2026-08-01T09:00:00.000Z',
  lastAnalysis: null,
};

const reanalyze = (ui: ReturnType<typeof render>) =>
  [...ui.container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Re-analyze'),
  )!;

const crumbs = (ui: ReturnType<typeof render>) =>
  [...ui.container.querySelectorAll('nav li')].map((li) =>
    li.textContent?.trim(),
  );

let ui: ReturnType<typeof render>;
let fetchMock: ReturnType<typeof stubApi>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = stubApi({ '/projects': { projects: [] }, ...runRoutes(report) });
});

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Header', () => {
  it('has nothing to re-analyse before a repository is named', () => {
    ui = render(Header, { pathname: '/hotspots' });

    expect(reanalyze(ui).disabled).toBe(true);
    expect(ui.container.textContent).toContain('No analysis yet');
  });

  it('breadcrumbs the project and the section', () => {
    localStorage.setItem('strata:root', '/home/dev/workspace/strata');
    ui = render(Header, { pathname: '/graph' });

    // Nothing registered: the repository's folder is all the name there is.
    expect(crumbs(ui)).toEqual(['strata', '/', 'Dependencies']);
  });

  it('re-runs the analysis of the remembered repository', async () => {
    localStorage.setItem('strata:root', '/home/dev/workspace/strata');

    ui = render(Header, { pathname: '/hotspots' });
    reanalyze(ui).click();

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('982eb56c');
    });

    const run = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )!;
    expect(String(run[0])).toContain('/analyze');
    // The workbench never waits on the request: it takes the job and follows it.
    expect(JSON.parse(String((run[1] as RequestInit).body))).toEqual({
      root: '/home/dev/workspace/strata',
      wait: false,
    });
  });

  it('chips the branch and revision of the last run, with its summary', () => {
    ui = render(Header, { pathname: '/hotspots' });

    const text = ui.container.textContent ?? '';
    expect(text).toContain('main');
    expect(text).toContain('982eb56c');
    expect(text).toContain('1.2k files');
    expect(text).toContain('2.4 s');
    expect(text).toContain('just now');
  });

  it('calls a registered project what the registry calls it', async () => {
    stubApi({ '/projects': { projects: [strata] }, ...runRoutes(report) });
    localStorage.setItem(SELECTION_STORAGE_KEY, 'strata');
    await projects.reload();

    ui = render(Header, { pathname: '/graph' });

    expect(crumbs(ui)).toEqual(['Strata workbench', '/', 'Dependencies']);
  });

  it('swaps the narrow-screen strip for the settings sections', () => {
    ui = render(Header, { pathname: '/settings/project' });

    const text = ui.container.textContent ?? '';
    expect(text).toContain('Back to workbench');
    expect(text).toContain('Danger zone');
    // The strip's own nav and switcher go with the rail's.
    expect(text).not.toContain('Dead code');
    expect(
      ui.container.querySelector('[aria-label="Current project"]'),
    ).toBeNull();
  });

  it('breadcrumbs the app settings under the workbench, not the project', () => {
    ui = render(Header, { pathname: '/settings/app' });

    expect(crumbs(ui)).toEqual(['Strata', '/', 'App settings']);
  });

  // Last, because the store is the app's and a failure is the state it keeps.
  it('says a run failed where the run summary is, rather than leaving the old one up', async () => {
    const reason =
      'Setting "convention" names commit-convention plugin "commit-gitmoji", ' +
      'which this workbench has not loaded.';
    stubApi({ '/projects': { projects: [] }, ...failedRunRoutes(reason) });
    localStorage.setItem('strata:root', '/home/dev/workspace/strata');

    ui = render(Header, { pathname: '/hotspots' });
    reanalyze(ui).click();

    const alert = await vi.waitFor(() => {
      const found = ui.container.querySelector('[role="alert"]');
      expect(found).not.toBeNull();
      return found!;
    });

    expect(alert.textContent).toContain('Run failed');
    // The plugin and the setting that asked for it, in full, for a reader who
    // has to go and fix one of them.
    expect(alert.getAttribute('title')).toBe(reason);
    // The chips of an older, successful run would read as this run's result.
    expect(ui.container.textContent).not.toContain('982eb56c');
  });
});
