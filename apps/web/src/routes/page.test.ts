import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { analysis } from '$lib/analysis';
import { runRoutes, stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import Page from './+page.svelte';

/**
 * The screen end to end: a run against the API folded into the six stat cards,
 * the hotspot bars, the cycle alert and the commit strip, with the workbench's
 * own plugins beside them.
 *
 * The repository is chosen in the switcher, which the shell holds — so a test
 * of this screen runs the analysis on the store first and then mounts the page
 * against the report that run left behind.
 *
 * `/plugins` answers the same thing in every test on purpose: the plugin store
 * is app-wide and loads once, so whichever test mounts first is the one that
 * fetches it.
 */

const PLUGINS = {
  directory: '/home/dev/.strata/plugins',
  plugins: [
    {
      id: 'strata-language-typescript',
      name: 'TypeScript',
      kind: 'language',
      version: '0.4.0',
      sdk: '0',
      main: 'dist/index.js',
      source: 'builtin',
    },
  ],
  failures: [],
};

const report = {
  rev: '4fea7c5deadbeef',
  run: {
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: '2026-08-15T11:55:00.000Z',
  },
  languages: {
    typescript: {
      graph: {
        nodes: [
          { id: 'src/a.ts', label: 'a.ts', kind: 'file' },
          { id: 'src/b.ts', label: 'b.ts', kind: 'file' },
        ],
        edges: [
          { from: 'src/a.ts', to: 'src/b.ts', kind: 'import' },
          { from: 'src/b.ts', to: 'src/a.ts', kind: 'import' },
        ],
        cycles: [['src/a.ts', 'src/b.ts']],
      },
      deadCode: [{ path: 'src/old.ts', reason: 'unreachable-file' }],
      metrics: [{ path: 'src/big.ts', loc: 940 }],
      summary: {
        nodes: 2,
        edges: 2,
        cycles: 1,
        cycleNodes: 2,
        maxFanIn: null,
        maxFanOut: null,
      },
    },
  },
  // Every language's graph as one, as the core folded it: the cards and the
  // cycle alert read these, not the per-language results above.
  dependencies: {
    nodes: [
      { id: 'src/a.ts', label: 'a.ts', kind: 'file' },
      { id: 'src/b.ts', label: 'b.ts', kind: 'file' },
    ],
    edges: [
      { from: 'src/a.ts', to: 'src/b.ts', kind: 'import' },
      { from: 'src/b.ts', to: 'src/a.ts', kind: 'import' },
    ],
    cycles: [
      { nodes: ['src/a.ts', 'src/b.ts'], path: ['src/a.ts', 'src/b.ts', 'src/a.ts'] },
    ],
    summary: {
      nodes: 2,
      edges: 2,
      cycles: 1,
      cycleNodes: 2,
      maxFanIn: null,
      maxFanOut: null,
    },
  },
  metrics: [
    {
      id: 'hotspots',
      label: 'Hotspots (churn × complexity)',
      points: [
        {
          subject: 'src/big.ts',
          value: 1900,
          meta: { churn: 19, complexity: 100 },
        },
        {
          subject: 'src/mid.ts',
          value: 475,
          meta: { churn: 10, complexity: 30 },
        },
      ],
    },
  ],
  commits: [
    { type: 'feat', scope: null, breaking: false, subject: 'a', tags: {}, valid: true },
    { type: 'fix', scope: null, breaking: true, subject: 'b', tags: {}, valid: true },
  ],
  cache: {
    enabled: false,
    hits: 0,
    misses: 0,
    runHits: 0,
    runMisses: 0,
    writes: 0,
  },
};

/** Analyse a repository, as picking a project and running it would. */
async function run(): Promise<void> {
  stubApi({ '/plugins': PLUGINS, ...runRoutes(report) });
  await analysis.run('/repo/strata');
}

let ui: ReturnType<typeof render>;

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('overview page', () => {
  it('asks for a project before anything has run, and still shows the workbench', async () => {
    stubApi({ '/plugins': PLUGINS });
    analysis.select('');

    ui = render(Page);

    expect(ui.container.textContent).toContain('Pick a project');
    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('TypeScript');
    });
  });

  it('leads with the six stat cards of the last run', async () => {
    await run();

    ui = render(Page);
    await tick();

    for (const label of [
      'Files',
      'Top hotspot',
      'Import cycles',
      'Commits',
      'Dead code',
      'Plugins',
    ]) {
      expect(ui.container.textContent).toContain(label);
    }
    expect(ui.container.textContent).toContain('1.2k');
    expect(ui.container.textContent).toContain('big.ts');
  });

  it('ranks the hotspots, alerts on the cycle and strips the commits', async () => {
    await run();

    ui = render(Page);
    await tick();

    // The bar list, measured against the top-ranked file.
    const widths = [...ui.container.querySelectorAll('li div[style]')].map(
      (fill) => (fill as HTMLElement).style.width,
    );
    expect(widths.slice(0, 2)).toEqual(['100.0%', '25.0%']);

    // The cycle, as the path a reader can act on.
    expect(ui.container.textContent).toContain('a.ts → b.ts → a.ts');

    // The change types of the analysed window.
    expect(ui.container.textContent).toContain('feat');
    expect(ui.container.textContent).toContain('1 breaking');
  });

  it('sends a stat card to the screen that shows it in full', async () => {
    await run();

    ui = render(Page);
    await tick();

    const hrefs = [...ui.container.querySelectorAll('a')].map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs).toContain('/hotspots');
    expect(hrefs).toContain('/graph');
  });

  it('surfaces a failed run', async () => {
    stubApi({
      '/plugins': PLUGINS,
      '/analyze': Response.json({ message: 'not a repository' }, { status: 400 }),
    });
    await analysis.run('/nope');

    ui = render(Page);

    expect(ui.container.textContent).toContain('not a repository');
  });
});
