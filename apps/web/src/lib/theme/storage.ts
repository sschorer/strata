import { isThemeMode, type ThemeMode } from './mode';

/**
 * Where the choice is remembered. The inline bootstrap in `app.html` reads the
 * same key before the app boots — keep the two in sync.
 */
export const THEME_STORAGE_KEY = 'strata:theme';

/** `null` when nothing valid is stored, or storage is unavailable. */
export function readStoredMode(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : null;
  } catch {
    // Private mode / storage disabled: fall back to the system preference.
    return null;
  }
}

export function storeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Not being able to remember the choice must not break the switch.
  }
}
