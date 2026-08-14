import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStoredMode, storeMode, THEME_STORAGE_KEY } from './storage';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('theme storage', () => {
  it('round-trips a mode', () => {
    storeMode('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(readStoredMode()).toBe('light');
  });

  it('is null when nothing was stored', () => {
    expect(readStoredMode()).toBeNull();
  });

  it('rejects a hand-edited value rather than applying it', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readStoredMode()).toBeNull();
  });

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(readStoredMode()).toBeNull();
    expect(() => storeMode('dark')).not.toThrow();
  });
});
