import { afterEach, describe, expect, it } from 'vitest';
import { cyclesOf } from '$lib/test/graph';
import { render } from '$lib/test/render';
import CycleAlert from './CycleAlert.svelte';

const cycles = cyclesOf([
  ['src/a.ts', 'src/b.ts'],
  ['src/c.ts', 'src/d.ts'],
  ['src/e.ts', 'src/f.ts'],
  ['src/g.ts', 'src/h.ts'],
]);

/** The rendered text on one line — the markup wraps where a sentence does not. */
const flat = (container: HTMLElement) =>
  container.textContent?.replace(/\s+/g, ' ') ?? '';

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('CycleAlert', () => {
  it('prints the knot as a path of file names', () => {
    ui = render(CycleAlert, { cycles: [cycles[0]!] });

    expect(ui.container.textContent).toContain('a.ts → b.ts → a.ts');
    expect(ui.container.textContent).toContain('2 files');
    // The full paths stay reachable without widening the card.
    expect(ui.container.querySelector('li')!.title).toBe(
      'src/a.ts → src/b.ts → src/a.ts',
    );
  });

  it('says how many there are in words, not only in red', () => {
    ui = render(CycleAlert, { cycles });

    expect(flat(ui.container)).toContain('4 import cycles');
  });

  it('shows the biggest few and sends the rest to the graph', () => {
    ui = render(CycleAlert, { cycles });

    expect(ui.container.querySelectorAll('li')).toHaveLength(3);
    expect(ui.container.querySelector('a')?.textContent).toContain(
      'All 4 on the dependency graph',
    );
    expect(ui.container.querySelector('a')?.getAttribute('href')).toBe('/graph');
  });

  it('says so when the graph is acyclic', () => {
    ui = render(CycleAlert, { cycles: [] });

    expect(ui.container.textContent).toContain('No import cycles');
    expect(ui.container.querySelector('a')).toBeNull();
  });
});
