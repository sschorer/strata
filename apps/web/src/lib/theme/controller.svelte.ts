import { applyTheme } from './apply';
import { resolveTheme, type ResolvedTheme, type ThemeMode } from './mode';
import { readStoredMode, storeMode } from './storage';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The app's appearance state: the mode the user picked, the OS preference, and
 * the theme that follows from the two. One instance, exported below — the
 * `<html>` attribute it writes is global anyway.
 */
class ThemeController {
  #mode = $state<ThemeMode>('system');
  #prefersDark = $state(true);

  get mode(): ThemeMode {
    return this.#mode;
  }

  get resolved(): ResolvedTheme {
    return resolveTheme(this.#mode, this.#prefersDark);
  }

  set(mode: ThemeMode): void {
    this.#mode = mode;
    storeMode(mode);
    applyTheme(this.resolved);
  }

  /**
   * Adopt the stored choice and track the OS preference. Call once from the
   * root layout; the returned function detaches the listener.
   */
  start(): () => void {
    const media = window.matchMedia(DARK_QUERY);
    this.#prefersDark = media.matches;
    this.#mode = readStoredMode() ?? 'system';
    applyTheme(this.resolved);

    const onChange = (event: MediaQueryListEvent) => {
      this.#prefersDark = event.matches;
      applyTheme(this.resolved);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }
}

export const theme = new ThemeController();
