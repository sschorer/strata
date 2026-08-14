import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '$lib/test/render';
import ThemeSwitch from './ThemeSwitch.svelte';

let ui: ReturnType<typeof render>;

function button(label: string): HTMLButtonElement {
  const match = [...ui.container.querySelectorAll('button')].find(
    (element) => element.textContent?.trim() === label,
  );
  if (!match) throw new Error(`no "${label}" button`);
  return match;
}

beforeEach(() => {
  localStorage.clear();
  ui = render(ThemeSwitch);
});

afterEach(() => {
  ui.destroy();
});

describe('ThemeSwitch', () => {
  it('offers the three modes', () => {
    expect(
      [...ui.container.querySelectorAll('button')].map((b) =>
        b.textContent?.trim(),
      ),
    ).toEqual(['dark', 'light', 'system']);
  });

  it('paints the picked theme and marks it as pressed', () => {
    button('light').click();
    flushSync();

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(button('light').getAttribute('aria-pressed')).toBe('true');
    expect(button('dark').getAttribute('aria-pressed')).toBe('false');
  });

  it('remembers the choice', () => {
    button('dark').click();
    flushSync();

    expect(localStorage.getItem('strata:theme')).toBe('dark');
  });
});
