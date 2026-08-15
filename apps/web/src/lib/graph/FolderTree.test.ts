import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import FolderTree from './FolderTree.svelte';
import type { FolderRow } from './rows';

const rows: FolderRow[] = [
  { path: 'packages', name: 'packages', depth: 0, files: 40, knotted: true, open: true },
  { path: 'packages/core/src', name: 'core/src', depth: 1, files: 28, knotted: false, open: false },
];

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('FolderTree', () => {
  it('indents by depth and marks what is open', () => {
    ui = render(FolderTree, { rows });

    const buttons = [...ui.container.querySelectorAll('button')].slice(2);
    expect(buttons[0]!.getAttribute('style')).toContain('0.5rem');
    expect(buttons[1]!.getAttribute('style')).toContain('1.35rem');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('false');
    expect(ui.container.textContent).toContain('1 of 2 open');
  });

  it('reports the folder that was clicked', () => {
    const ontoggle = vi.fn();
    ui = render(FolderTree, { rows, ontoggle });

    [...ui.container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('core/src'))!
      .click();

    expect(ontoggle).toHaveBeenCalledWith('packages/core/src');
  });

  it('opens and closes everything at once', () => {
    const onall = vi.fn();
    ui = render(FolderTree, { rows, onall });

    ui.container.querySelector('button')!.click();
    expect(onall).toHaveBeenCalledWith(true);
  });
});
