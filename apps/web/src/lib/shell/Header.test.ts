import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import Header from './Header.svelte';

/**
 * The header reads the app-wide analysis store, which is a single instance and
 * survives between the tests below — so the first test here is the one that
 * runs before any repository has been named.
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

const reanalyze = (ui: ReturnType<typeof render>) =>
  [...ui.container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Re-analyze'),
  )!;

let ui: ReturnType<typeof render>;

beforeEach(() => {
  localStorage.clear();
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

    const crumbs = [...ui.container.querySelectorAll('nav li')].map((li) =>
      li.textContent?.trim(),
    );
    expect(crumbs).toEqual(['strata', '/', 'Dependencies']);
  });

  it('re-runs the analysis of the remembered repository', async () => {
    const fetchMock = vi.fn(async () => Response.json(report));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('strata:root', '/home/dev/workspace/strata');

    ui = render(Header, { pathname: '/hotspots' });
    reanalyze(ui).click();

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('982eb56c');
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain('/analyze');
    expect(JSON.parse(String(init.body))).toEqual({
      root: '/home/dev/workspace/strata',
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
});
