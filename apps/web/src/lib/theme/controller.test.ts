import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from './controller.svelte';
import { THEME_STORAGE_KEY } from './storage';

/** A `matchMedia` whose preference the test can flip. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches: prefersDark,
    addEventListener: vi.fn((_: string, listener: EventListener) =>
      listeners.add(listener as (event: MediaQueryListEvent) => void),
    ),
    removeEventListener: vi.fn((_: string, listener: EventListener) =>
      listeners.delete(listener as (event: MediaQueryListEvent) => void),
    ),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );

  return {
    media,
    /** Simulate the OS switching theme while the app is open. */
    change(matches: boolean) {
      media.matches = matches;
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
  };
}

const painted = () => document.documentElement.dataset.theme;

let stop: () => void = () => {};

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
});

describe('theme controller', () => {
  it('starts in system mode and paints the OS preference', () => {
    stubMatchMedia(true);

    stop = theme.start();

    expect(theme.mode).toBe('system');
    expect(theme.resolved).toBe('dark');
    expect(painted()).toBe('dark');
  });

  it('adopts the stored choice over the OS preference', () => {
    stubMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    stop = theme.start();

    expect(theme.mode).toBe('light');
    expect(painted()).toBe('light');
  });

  it('remembers and paints an explicit choice', () => {
    stubMatchMedia(true);
    stop = theme.start();

    theme.set('light');

    expect(painted()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('follows the OS while in system mode', () => {
    const os = stubMatchMedia(true);
    stop = theme.start();

    os.change(false);

    expect(theme.resolved).toBe('light');
    expect(painted()).toBe('light');
  });

  it('ignores the OS once a mode is pinned', () => {
    const os = stubMatchMedia(true);
    stop = theme.start();
    theme.set('dark');

    os.change(false);

    expect(theme.resolved).toBe('dark');
    expect(painted()).toBe('dark');
  });

  it('detaches the OS listener when stopped', () => {
    const os = stubMatchMedia(true);

    theme.start()();

    expect(os.media.removeEventListener).toHaveBeenCalled();
  });
});
