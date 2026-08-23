import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import type { StageEntry } from '@strata/sdk';
import { analysis } from '$lib/analysis';
import { HOTSPOT_STAGE_ID } from '$lib/hotspots';
import { partialRunRoutes, runRoutes, stubApi } from '$lib/test/api';
import { graphOf, languageOf } from '$lib/test/graph';
import { render } from '$lib/test/render';
import { reportOf } from '$lib/test/report';
import { failedStage, okStage, skippedStage } from '$lib/test/stages';
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
  return reportOf({
    rev,
    stages: {
      'strata-language-typescript': okStage('graph', {
        ...languageOf(graphOf('')),
        metrics: [{ path: 'src/big.ts', loc: 940 }],
      }),
      [HOTSPOT_STAGE_ID]: okStage('metrics', {
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
      }),
    },
  });
}

/** Analyse a repository, as picking a project and running it would. */
async function run(rev: string): Promise<void> {
  stubApi(runRoutes(reportWith(rev)));
  await analysis.run('/repo/strata');
}

/** A partial run: the hotspot stage ended as `entry`, and is all there is. */
async function partial(entry: StageEntry): Promise<void> {
  stubApi(partialRunRoutes(reportOf({ stages: { [HOTSPOT_STAGE_ID]: entry } })));
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

  it('says the stage failed where the ranking would have been', async () => {
    await partial(failedStage('metrics', 'git log exploded'));

    ui = render(Page);
    await tick();

    expect(ui.container.textContent).toContain(HOTSPOT_STAGE_ID);
    expect(ui.container.textContent).toContain('failed');
    expect(ui.container.textContent).toContain('git log exploded');
    // Not the ranking's own empty state: nothing here found nothing.
    expect(ui.container.textContent).not.toContain('No hotspot scores');
  });

  it('tells a stage that never ran from one that ranked nothing', async () => {
    await partial(
      skippedStage(
        'metrics',
        '"strata-commit-conventional" failed, and this stage consumes what it produces',
        'strata-commit-conventional',
      ),
    );

    ui = render(Page);
    await tick();

    expect(ui.container.textContent).toContain('did not run');
    expect(ui.container.textContent).toContain('strata-commit-conventional');
  });

  it('renders an empty state for a run with no hotspot stage at all', async () => {
    stubApi(runRoutes(reportOf()));
    await analysis.run('/repo/strata');

    ui = render(Page);
    await tick();

    expect(ui.container.textContent).toContain('No stage in this report ranks');
    expect(ui.container.querySelector('.text-danger')).toBeNull();
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
