/**
 * Where this browser keeps the workbench token. Same storage as the theme, for
 * the same reason: there is no server session to hang it on, and the SPA has
 * to survive a reload without asking again.
 */
export const TOKEN_STORAGE_KEY = 'strata:token';

/** `null` when nothing is stored, or storage is unavailable. */
export function readStoredToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)?.trim();
    return stored ? stored : null;
  } catch {
    // Private mode / storage disabled: the reader unlocks once per session.
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Not being able to remember it must not stop this session working.
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to do — there is no storage to clear.
  }
}
