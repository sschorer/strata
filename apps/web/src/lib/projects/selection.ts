/**
 * Which registered project the workbench is pointed at. Only the id is kept:
 * the project itself is the registry's, so a rename or a re-pointed root is
 * picked up on the next load rather than remembered wrong here.
 */
export const SELECTION_STORAGE_KEY = 'strata:project';

/** `null` when nothing is stored, or storage is unavailable. */
export function readSelection(): string | null {
  try {
    const stored = localStorage.getItem(SELECTION_STORAGE_KEY);
    return stored && stored.trim() ? stored : null;
  } catch {
    // Private mode / storage disabled: the app opens without a project.
    return null;
  }
}

/** `null` clears it — nothing is selected once the entry is removed. */
export function storeSelection(id: string | null): void {
  try {
    if (id) localStorage.setItem(SELECTION_STORAGE_KEY, id);
    else localStorage.removeItem(SELECTION_STORAGE_KEY);
  } catch {
    // Not remembering the choice must not break the switcher.
  }
}
