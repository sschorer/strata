import type { GraphCycle } from '@strata/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import CycleList from './CycleList.svelte';

const cycles: GraphCycle[] = [
  {
    nodes: ['src/a.ts', 'src/b.ts'],
    path: ['src/a.ts', 'src/b.ts', 'src/a.ts'],
  },
];

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('CycleList', () => {
  it('prints the cycle as a path of file names', () => {
    ui = render(CycleList, { cycles });

    expect(ui.container.textContent).toContain('a.ts → b.ts → a.ts');
    expect(ui.container.textContent).toContain('2 files');
    // The full paths stay reachable without widening the panel.
    expect(ui.container.querySelector('button')!.title).toBe(
      'src/a.ts → src/b.ts → src/a.ts',
    );
  });

  it('reports the clicked cycle and marks it selected', () => {
    const onselect = vi.fn();
    ui = render(CycleList, { cycles, selected: 1, onselect });

    const button = ui.container.querySelector('button')!;
    button.click();

    expect(onselect).toHaveBeenCalledWith(1);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('says so when the graph is acyclic', () => {
    ui = render(CycleList, { cycles: [] });
    expect(ui.container.textContent).toContain('No import cycles');
  });
});
