import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectAnalysis } from '$lib/api';
import {
  readRecents,
  RECENTS_STORAGE_KEY,
  storeRecents,
} from './recents-storage';

const run: ProjectAnalysis = {
  rev: '7f80d51cafe',
  branch: 'main',
  files: 1240,
  durationMs: 2440,
  finishedAt: '2026-08-16T09:00:00.000Z',
};

afterEach(() => {
  localStorage.clear();
});

describe('recents storage', () => {
  it('keeps a log per project', () => {
    storeRecents('strata', [run]);
    storeRecents('other', []);

    expect(readRecents('strata')).toEqual([run]);
    expect(readRecents('other')).toEqual([]);
  });

  it('leaves the other projects alone', () => {
    storeRecents('strata', [run]);
    storeRecents('other', [{ ...run, rev: 'deadbeef' }]);

    expect(readRecents('strata')).toEqual([run]);
  });

  it('drops the entry when a log empties', () => {
    storeRecents('strata', [run]);
    storeRecents('strata', []);

    expect(localStorage.getItem(RECENTS_STORAGE_KEY)).toBe('{}');
  });

  it('reads nothing for a project that has none', () => {
    expect(readRecents('strata')).toEqual([]);
  });

  it('ignores anything that is not a stored log', () => {
    localStorage.setItem(RECENTS_STORAGE_KEY, 'not json');
    expect(readRecents('strata')).toEqual([]);

    localStorage.setItem(RECENTS_STORAGE_KEY, '["strata"]');
    expect(readRecents('strata')).toEqual([]);
  });

  it('drops entries that are not runs', () => {
    localStorage.setItem(
      RECENTS_STORAGE_KEY,
      JSON.stringify({ strata: [run, { rev: 'half a run' }, 7] }),
    );

    expect(readRecents('strata')).toEqual([run]);
  });
});
