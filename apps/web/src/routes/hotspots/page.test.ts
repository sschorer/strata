import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import Page from './+page.svelte';

/**
 * The screen end to end: a run against the API, the report folded into tiles
 * and rows, and one selection shared by both panels.
 *
 * The analysis store is the app's single instance, so it survives between the
 * tests below — each run therefore carries its own `rev`, and a test waits for
 * that `rev` on screen before touching anything.
 */

function reportWith(rev: string) {
  return {
    rev,
    languages: {
      typescript: {
        graph: { nodes: [], edges: [], cycles: [] },
        deadCode: [],
        metrics: [{ path: 'src/big.ts', loc: 940 }],
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

/** Run the analysis from the form, as a user would. */
function submit(container: HTMLElement, root: string): void {
  const input = container.querySelector<HTMLInputElement>(
    'input[name="root"]',
  )!;
  input.value = root;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  container
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
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
  it('asks for a repository before anything has run', () => {
    ui = render(Page);
    expect(ui.container.textContent).toContain('Point Strata at a repository');
  });

  it('renders the treemap and the ranked table from one run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(reportWith('11111111aaaa'))),
    );

    ui = render(Page);
    submit(ui.container, '/repo/strata');

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('rev 11111111');
    });

    expect(tiles(ui.container)).toHaveLength(2);
    expect(ui.container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(ui.container.textContent).toContain('2 scored files');
    // Only the file a language plugin measured has a line count.
    expect(ui.container.textContent).toContain('940');
  });

  it('shows the details of the tile that was clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(reportWith('22222222bbbb'))),
    );

    ui = render(Page);
    submit(ui.container, '/repo/strata');

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('rev 22222222');
    });

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

    ui = render(Page);
    submit(ui.container, '/nope');

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('not a repository');
    });
  });
});
