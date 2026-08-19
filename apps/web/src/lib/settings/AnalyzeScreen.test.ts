import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysis } from '$lib/analysis';
import type {
  AnalysisReport,
  LoadedPluginInfo,
  Project,
  ProjectConfig,
} from '$lib/api';
import { PluginsStore } from '$lib/plugins';
import { ProjectsStore, SELECTION_STORAGE_KEY } from '$lib/projects';
import { runRoutes, stubApi } from '$lib/test/api';
import { noCommits } from '$lib/test/commits';
import { render } from '$lib/test/render';
import AnalyzeScreen from './AnalyzeScreen.svelte';
import { ProjectConfigStore } from './config.svelte';
import { readRecents } from './recents-storage';

/**
 * The *Analyze / run* section end to end, against a stubbed API. Each test
 * gets its own registry, config and plugin stores; the analysis store the run
 * goes through is the app's single instance, so that one is cleared first.
 */

const strata: Project = {
  id: 'strata',
  name: 'Strata',
  root: '/home/dev/workspace/strata',
  addedAt: '2026-08-01T09:00:00.000Z',
  lastAnalysis: null,
};

const config: ProjectConfig = {
  rev: 'main',
  historyLimit: 500,
  ignore: [],
  paths: [],
  languages: null,
  metrics: null,
  convention: null,
  rules: [],
};

const loaded: LoadedPluginInfo[] = [
  {
    id: 'strata-language-typescript',
    name: 'TypeScript',
    kind: 'language',
    version: '0.4.0',
    sdk: '0',
    main: 'dist/index.js',
    source: 'builtin',
  },
  {
    id: 'strata-ai-codex',
    name: 'Codex',
    kind: 'ai-provider',
    version: '0.1.0',
    sdk: '0',
    main: 'dist/index.js',
    source: 'user',
  },
];

const report: AnalysisReport = {
  rev: '7f80d51cafebabe',
  run: {
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: '2026-08-16T09:00:00.000Z',
  },
  languages: {},
  metrics: [],
  commits: [],
  commitAnalytics: noCommits(),
  cache: {
    enabled: true,
    hits: 0,
    misses: 0,
    runHits: 0,
    runMisses: 0,
    writes: 0,
  },
};

/** The rendered text on one line — the markup wraps where a sentence does not. */
const flat = (node: Element | null) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** The recents card — the plugin chips are a list of `li` too. */
const recents = (container: HTMLElement) =>
  [...container.querySelectorAll('section')].find((card) =>
    card.textContent?.includes('Recent runs'),
  )!;

const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((element) =>
    element.textContent?.includes(text),
  )!;

/** Mount the screen over a registry, a config and the plugins, and let them arrive. */
async function open(
  routes: Record<string, unknown> = {},
  registered: Project[] = [strata],
) {
  const first = registered[0];
  if (first) localStorage.setItem(SELECTION_STORAGE_KEY, first.id);
  const fetchMock = stubApi({
    '/projects': { projects: registered },
    '/projects/strata/config': config,
    '/plugins': { directory: '/plugins', plugins: loaded, failures: [] },
    ...routes,
  });
  const projects = new ProjectsStore();
  const configStore = new ProjectConfigStore();
  const plugins = new PluginsStore();
  const ui = render(AnalyzeScreen, {
    projects,
    config: configStore,
    plugins,
  });

  await vi.waitFor(() => {
    expect(projects.status).toBe('ready');
  });
  return { ui, projects, config: configStore, plugins, fetchMock };
}

let ui: ReturnType<typeof render>;

beforeEach(() => {
  analysis.select('');
  localStorage.clear();
});

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('AnalyzeScreen', () => {
  it('says what the next run will read', async () => {
    const opened = await open();
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('/home/dev/workspace/strata');
    });
    const text = flat(ui.container);
    expect(text).toContain('main');
    expect(text).toContain('Last 500 commits');
  });

  it('chips the plugins that take part, and says why the others do not', async () => {
    const opened = await open();
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('TypeScript');
    });
    expect(flat(ui.container)).toContain('Codex stands by');
  });

  it('runs the analysis over the project the workbench is on', async () => {
    const opened = await open(runRoutes(report));
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(button(ui.container, 'Run analysis')).toBeTruthy();
    });
    button(ui.container, 'Run analysis').click();

    await vi.waitFor(() => {
      expect(analysis.status).toBe('ready');
    });
    const call = opened.fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
      root: '/home/dev/workspace/strata',
      wait: false,
    });
  });

  it('lists the run it just made, and remembers it', async () => {
    const opened = await open(runRoutes(report));
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(button(ui.container, 'Run analysis')).toBeTruthy();
    });
    button(ui.container, 'Run analysis').click();

    await vi.waitFor(() => {
      expect(flat(ui.container)).toContain('7f80d51c');
    });
    expect(readRecents('strata')).toHaveLength(1);
    // The switcher is not mounted in settings, so the screen folds the run into
    // the registry itself — the dropdown must not say "never analysed" after it.
    expect(opened.projects.current?.lastAnalysis).toMatchObject({
      rev: '7f80d51cafebabe',
    });
  });

  it('opens on the run the registry knows about, and on this browser’s log', async () => {
    const analysed: Project = {
      ...strata,
      lastAnalysis: {
        rev: 'aaaa1111bbbb',
        branch: 'main',
        files: 900,
        durationMs: 1200,
        finishedAt: '2026-08-14T09:00:00.000Z',
      },
    };
    localStorage.setItem(
      'strata:recents',
      JSON.stringify({
        strata: [
          {
            rev: 'cccc2222dddd',
            branch: 'main',
            files: 880,
            durationMs: 1100,
            finishedAt: '2026-08-13T09:00:00.000Z',
          },
        ],
      }),
    );

    const opened = await open({}, [analysed]);
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(flat(ui.container)).toContain('aaaa1111');
    });
    // Newest first: the registry's run is more recent than the stored one.
    const rows = [...recents(ui.container).querySelectorAll('li')].map((row) =>
      flat(row),
    );
    expect(rows[0]).toContain('aaaa1111');
    expect(rows.some((row) => row.includes('cccc2222'))).toBe(true);
  });

  it('surfaces a run the server refused', async () => {
    const opened = await open({
      'POST /analyze': Response.json(
        { message: 'not a git repository' },
        { status: 400 },
      ),
    });
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(button(ui.container, 'Run analysis')).toBeTruthy();
    });
    button(ui.container, 'Run analysis').click();

    await vi.waitFor(() => {
      const alert = ui.container.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('not a git repository');
    });
  });

  it('asks for a project rather than a run when none is selected', async () => {
    const opened = await open({}, []);
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(opened.projects.status).toBe('ready');
    });
    expect(ui.container.textContent).toContain('An analysis is always of one');
    expect(button(ui.container, 'Run analysis')).toBeUndefined();
  });

  it('offers a way back when the config could not be read', async () => {
    const opened = await open({
      '/projects/strata/config': Response.json(
        { message: 'registry unreadable' },
        { status: 500 },
      ),
    });
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('registry unreadable');
    });
    expect(button(ui.container, 'Try again')).toBeTruthy();
  });
});
