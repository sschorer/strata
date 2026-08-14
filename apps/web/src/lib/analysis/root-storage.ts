/**
 * The repo the workbench last analysed. A stop-gap: once the project switcher
 * lands, the registered projects replace this single remembered path.
 */
export const ROOT_STORAGE_KEY = 'strata:root';

/** `null` when nothing is stored, or storage is unavailable. */
export function readStoredRoot(): string | null {
  try {
    const stored = localStorage.getItem(ROOT_STORAGE_KEY);
    return stored && stored.trim() ? stored : null;
  } catch {
    // Private mode / storage disabled: the field simply starts empty.
    return null;
  }
}

export function storeRoot(root: string): void {
  try {
    localStorage.setItem(ROOT_STORAGE_KEY, root);
  } catch {
    // Not remembering the path must not fail the analysis.
  }
}
