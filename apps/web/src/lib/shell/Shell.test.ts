import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import Shell from './Shell.svelte';

const children = createRawSnippet(() => ({
  render: () => '<p>screen content</p>',
}));

let ui: ReturnType<typeof render>;

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Shell', () => {
  it('frames a screen with the rail, the header and one scrolling pane', () => {
    stubApi({
      '/plugins': { directory: '/plugins', plugins: [], failures: [] },
      '/projects': { projects: [] },
    });

    ui = render(Shell, { pathname: '/hotspots', children });

    expect(ui.container.querySelector('aside')).not.toBeNull();
    // The header sticks to the pane that scrolls, not to the window.
    const header = ui.container.querySelector('header')!;
    expect(header.className).toContain('sticky');
    expect(header.parentElement?.className).toContain('overflow-y-auto');
    // Exactly one main landmark: the screens render inside it.
    expect(ui.container.querySelectorAll('main')).toHaveLength(1);
    expect(ui.container.querySelector('main')?.textContent).toContain(
      'screen content',
    );
  });
});
