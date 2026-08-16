import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { analysis } from '$lib/analysis';
import { render } from '$lib/test/render';
import Page from './+page.svelte';

/**
 * The screen end to end: a run against the API, the report folded into tiles
 * and rows, and one selection shared by both panels.
 *
 * The repository is chosen in the switcher, which the shell holds — so a test
 * of this screen runs the analysis on the store first and then mounts the page
 * against the report that run left behind.
 */

function reportWith(rev: string) {
  return {
    rev,
    languages: {
      typescript: {
        graph: { nodes: [], edges: [], cycles: [] },
        deadCode: [],
        metrics: [{ path: 'src/big.ts', loc: 940 }],
        summary: {
          nodes: 0,
          edges: 0,
          cycles: 0,
          cycleNodes: 0,
          maxFanIn: null,
          maxFanOut: null,
        },
      },
    },
    metrics: [
      {
        id: 'hotspots',
        label: 'Hotspots (churn × complexity)',
        points: [
          {
            subject: 'src/big.ts',
            value: 900,
            meta: { churn: 9, complexity: 100 },
          },
          {
            subject: 'src/mid.ts',
            value: 300,
            meta: { churn: 10, complexity: 30 },
          },
        ],
      },
    ],
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
}

/** Analyse a repository, as picking a project and running it would. */
async function run(rev: string): Promise<void> {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(reportWith(rev))),
  );
  await analysis.run('/repo/strata');
}

const tiles = (container: HTMLElement) =>
  container.querySelectorAll<HTMLButtonElement>('button[title]');

let ui: ReturnType<typeof render>;

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('hotspots page', () => {
  it('asks for a project before anything has run', () => {
    ui = render(Page);
    expect(ui.container.textContent).toContain('Pick a project');
  });

  it('renders the treemap and the ranked table from one run', async () => {
    await run('11111111aaaa');

    ui = render(Page);
    await tick();

    expect(tiles(ui.container)).toHaveLength(2);
    expect(ui.container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(ui.container.textContent).toContain('2 scored files');
    // Only the file a language plugin measured has a line count.
    expect(ui.container.textContent).toContain('940');
  });

  it('shows the details of the tile that was clicked', async () => {
    await run('22222222bbbb');

    ui = render(Page);
    // The mount's effects run first: a new report clears the selection.
    await tick();

    [...tiles(ui.container)]
      .find((tile) => tile.title.includes('src/mid.ts'))!
      .click();

    await vi.waitFor(() => {
      expect(ui.container.querySelector('dl')?.textContent).toContain(
        'src/mid.ts',
      );
    });
    // The ranked table follows the same selection.
    expect(
      ui.container.querySelector('tbody [aria-pressed="true"]')?.textContent,
    ).toContain('src/mid.ts');
  });

  it('surfaces a failed run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ message: 'not a repository' }, { status: 400 }),
      ),
    );
    await analysis.run('/nope');

    ui = render(Page);

    expect(ui.container.textContent).toContain('not a repository');
  });
});
