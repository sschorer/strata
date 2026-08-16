import { afterEach, describe, expect, it } from 'vitest';
import { render } from '$lib/test/render';
import StatGrid from './StatGrid.svelte';
import type { StatCard } from './stats';

const cards: StatCard[] = [
  { key: 'files', label: 'Files', value: '1.2k', hint: 'typescript', tone: 'plain' },
  {
    key: 'hotspot',
    label: 'Top hotspot',
    value: 'big.ts',
    hint: 'score 1.9k',
    tone: 'plain',
    title: 'src/big.ts',
    href: '/hotspots',
  },
  {
    key: 'cycles',
    label: 'Import cycles',
    value: '2',
    hint: '5 files',
    tone: 'danger',
    href: '/graph',
  },
];

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('StatGrid', () => {
  it('prints a label, a value and a hint per card', () => {
    ui = render(StatGrid, { cards });

    expect(ui.container.textContent).toContain('Files');
    expect(ui.container.textContent).toContain('1.2k');
    expect(ui.container.textContent).toContain('typescript');
  });

  it('links the cards whose screen is built, and only those', () => {
    ui = render(StatGrid, { cards });

    const links = [...ui.container.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/hotspots',
      '/graph',
    ]);
  });

  it('keeps the full text of a truncated value in the tooltip', () => {
    ui = render(StatGrid, { cards });

    const values = [...ui.container.querySelectorAll('[title]')];
    expect(values.map((value) => value.getAttribute('title'))).toContain(
      'src/big.ts',
    );
  });

  it('says a bad number in words as well as in colour', () => {
    ui = render(StatGrid, { cards });

    // The tone paints the value; the label beside it is what names the number.
    expect(ui.container.querySelector('.text-danger')?.textContent).toContain(
      '2',
    );
    expect(ui.container.textContent).toContain('Import cycles');
  });
});
