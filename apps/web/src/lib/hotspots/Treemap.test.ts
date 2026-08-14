import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import { heatScale } from './heat';
import type { HotspotRow } from './rows';
import Treemap from './Treemap.svelte';

const rows: HotspotRow[] = [
  { path: 'src/big.ts', score: 900, churn: 9, complexity: 100, loc: 400 },
  { path: 'src/mid.ts', score: 300, churn: 10, complexity: 30, loc: 120 },
  { path: 'src/small.ts', score: 100, churn: 5, complexity: 20, loc: 60 },
];

const scale = heatScale(rows.map((row) => row.complexity));

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('Treemap', () => {
  it('gives the hottest file the largest tile', () => {
    ui = render(Treemap, { rows, scale });

    const tiles = [...ui.container.querySelectorAll('button')];
    expect(tiles).toHaveLength(3);

    const areaOf = (tile: Element) => {
      const style = tile.getAttribute('style') ?? '';
      const width = Number(/width: ([\d.]+)%/.exec(style)?.[1]);
      const height = Number(/height: ([\d.]+)%/.exec(style)?.[1]);
      return width * height;
    };

    expect(areaOf(tiles[0]!)).toBeGreaterThan(areaOf(tiles[1]!));
    expect(areaOf(tiles[1]!)).toBeGreaterThan(areaOf(tiles[2]!));
    expect(tiles[0]!.getAttribute('title')).toContain('src/big.ts');
  });

  it('colours by complexity, not by score', () => {
    ui = render(Treemap, { rows, scale });

    const [hottest, middle] = [...ui.container.querySelectorAll('button')];
    expect(hottest!.getAttribute('style')).toContain(
      'background: var(--strata-h5)',
    );
    expect(middle!.getAttribute('style')).toContain(
      'background: var(--strata-h3)',
    );
  });

  it('reports the clicked path and marks it selected', () => {
    const onselect = vi.fn();
    ui = render(Treemap, { rows, scale, selected: 'src/mid.ts', onselect });

    const tiles = [...ui.container.querySelectorAll('button')];
    tiles[0]!.click();

    expect(onselect).toHaveBeenCalledWith('src/big.ts');
    expect(tiles[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(tiles[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('caps the tiles and says how many files were left out', () => {
    ui = render(Treemap, { rows, scale, limit: 2 });

    expect(ui.container.querySelectorAll('button')).toHaveLength(2);
    expect(ui.container.textContent).toContain('top 2 of 3');
  });

  it('says so when nothing scored', () => {
    ui = render(Treemap, { rows: [], scale: heatScale([]) });
    expect(ui.container.textContent).toContain('No file scored above zero');
  });
});
