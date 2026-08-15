import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import Page from './+page.svelte';

/**
 * The screen end to end: a run against the API, the languages' graphs merged
 * and drawn, and one selection shared by the canvas and the cycle list.
 *
 * The analysis store is the app's single instance and survives between the
 * tests below, so each run carries its own `rev` and a test waits for that
 * `rev` on screen before touching anything.
 */

function reportWith(rev: string) {
  return {
    rev,
    languages: {
      typescript: {
        graph: {
          nodes: [
            { id: 'src/a.ts', label: 'src/a.ts', kind: 'file', meta: { loc: 40 } },
            { id: 'src/b.ts', label: 'src/b.ts', kind: 'file', meta: { loc: 12 } },
            { id: 'src/c.ts', label: 'src/c.ts', kind: 'file', meta: { loc: 7 } },
          ],
          edges: [
            { from: 'src/a.ts', to: 'src/b.ts', kind: 'import' },
            { from: 'src/b.ts', to: 'src/a.ts', kind: 'import' },
            { from: 'src/c.ts', to: 'src/a.ts', kind: 'import' },
          ],
          cycles: [['src/b.ts', 'src/a.ts']],
        },
        deadCode: [],
        metrics: [],
      },
    },
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
}

/** Run the analysis from the form, as a user would. */
function submit(container: HTMLElement, root: string): void {
  const input = container.querySelector<HTMLInputElement>('input[name="root"]')!;
  input.value = root;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  container
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/** The canvas alone: the edge legend draws lines of its own. */
const canvas = (container: HTMLElement) =>
  container.querySelector<SVGElement>('svg[role="group"]')!;

const nodeFor = (container: HTMLElement, id: string) =>
  [...container.querySelectorAll('rect[role="button"][aria-label]')].find(
    (card) => card.getAttribute('aria-label') === id,
  )!;

const cycleButton = (container: HTMLElement) =>
  [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('a.ts → b.ts'),
  )!;

let ui: ReturnType<typeof render>;

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('graph page', () => {
  it('asks for a repository before anything has run', () => {
    ui = render(Page);
    expect(ui.container.textContent).toContain('Point Strata at a repository');
  });

  it('draws the graph and summarises it from one run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(reportWith('11111111aaaa'))),
    );

    ui = render(Page);
    submit(ui.container, '/repo/strata');

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('rev 11111111');
    });

    expect(
      canvas(ui.container).querySelectorAll('rect[role="button"][aria-label]'),
    ).toHaveLength(3);
    expect(canvas(ui.container).querySelectorAll('line')).toHaveLength(3);
    // Summary: three nodes, three edges, one cycle over two files.
    expect(ui.container.textContent).toContain('3 files · 3 imports');
    expect(ui.container.textContent).toContain('a.ts → b.ts → a.ts');
    // Max fan-in: `a.ts`, imported by both of the others.
    expect(ui.container.querySelector('dl')!.textContent).toContain('a.ts');
  });

  it('shows the details of the node that was clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(reportWith('22222222bbbb'))),
    );

    ui = render(Page);
    submit(ui.container, '/repo/strata');

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('rev 22222222');
    });

    nodeFor(ui.container, 'src/a.ts').dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    await vi.waitFor(() => {
      const detail = [...ui.container.querySelectorAll('dl')]
        .map((list) => list.textContent ?? '')
        .find((text) => text.includes('src/a.ts'))!;
      // Two files import it, it imports one, 40 lines, first cycle.
      expect(detail).toContain('Fan-in');
      expect(detail).toContain('40');
      expect(detail).toContain('#1');
    });

    // Selecting a node in a cycle selects that cycle in the list too.
    expect(cycleButton(ui.container).getAttribute('aria-pressed')).toBe('true');
  });

  it('lights up a cycle picked from the list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(reportWith('33333333cccc'))),
    );

    ui = render(Page);
    submit(ui.container, '/repo/strata');

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('rev 33333333');
    });

    cycleButton(ui.container).click();

    await vi.waitFor(() => {
      expect(
        nodeFor(ui.container, 'src/c.ts').closest('g')!.getAttribute('opacity'),
      ).toBe('0.25');
    });
    expect(
      nodeFor(ui.container, 'src/a.ts').closest('g')!.getAttribute('opacity'),
    ).toBe('1');
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
