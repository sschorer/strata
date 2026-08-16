import { afterEach, describe, expect, it } from 'vitest';
import { heatScale } from '$lib/hotspots';
import { render } from '$lib/test/render';
import type { HotspotBar } from './bars';
import HotspotBars from './HotspotBars.svelte';

const bars: HotspotBar[] = [
  { path: 'src/lib/big.ts', score: 1900, complexity: 100, share: 1 },
  { path: 'src/mid.ts', score: 475, complexity: 30, share: 0.25 },
];

const scale = heatScale([100, 30]);

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('HotspotBars', () => {
  it('prints the file apart from its directory, with the score beside it', () => {
    ui = render(HotspotBars, { bars, scale });

    expect(ui.container.textContent).toContain('src/lib/');
    expect(ui.container.textContent).toContain('big.ts');
    expect(ui.container.textContent).toContain('1.9k');
    expect(ui.container.querySelector('[title]')?.getAttribute('title')).toBe(
      'src/lib/big.ts',
    );
  });

  it('sizes each bar by its share of the top file', () => {
    ui = render(HotspotBars, { bars, scale });

    const widths = [...ui.container.querySelectorAll('li div[style]')].map(
      (fill) => (fill as HTMLElement).style.width,
    );
    expect(widths).toEqual(['100.0%', '25.0%']);
  });

  it('says so when nothing scored', () => {
    ui = render(HotspotBars, { bars: [], scale });

    expect(ui.container.textContent).toContain('No hotspot scores');
    expect(ui.container.querySelectorAll('li')).toHaveLength(0);
  });
});
