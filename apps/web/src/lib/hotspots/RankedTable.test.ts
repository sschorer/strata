import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import { heatScale } from './heat';
import RankedTable from './RankedTable.svelte';
import type { HotspotRow } from './rows';

const rows: HotspotRow[] = [
  { path: 'src/big.ts', score: 12_400, churn: 62, complexity: 200, loc: 940 },
  { path: 'src/mid.ts', score: 300, churn: 10, complexity: 30, loc: null },
];

const scale = heatScale(rows.map((row) => row.complexity));

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('RankedTable', () => {
  it('ranks the rows and shows every factor of the score', () => {
    ui = render(RankedTable, { rows, scale });

    const cells = [...ui.container.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    );

    expect(cells[0]).toEqual(['1', 'src/big.ts', '62', '200', '940', '12k']);
    // No language plugin claimed the file, so there is no line count to show.
    expect(cells[1]).toEqual(['2', 'src/mid.ts', '10', '30', '—', '300']);
  });

  it('selects a file from its name', () => {
    const onselect = vi.fn();
    ui = render(RankedTable, { rows, scale, selected: 'src/mid.ts', onselect });

    const buttons = [
      ...ui.container.querySelectorAll<HTMLButtonElement>('tbody button'),
    ];
    buttons[0]!.click();

    expect(onselect).toHaveBeenCalledWith('src/big.ts');
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('trims a long ranking and counts what it left out', () => {
    ui = render(RankedTable, { rows, scale, limit: 1 });

    expect(ui.container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(ui.container.textContent).toContain('1 of 2 scored files');
  });
});
