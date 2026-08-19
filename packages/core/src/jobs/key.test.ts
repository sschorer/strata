import { describe, expect, it } from 'vitest';
import { requestKey } from './key.js';

/**
 * The digest decides which requests are the same run. Two that would walk the
 * same repository the same way have to collide; two that would not must never.
 */
describe('requestKey', () => {
  it('is the same for two requests that ask the same thing', () => {
    expect(requestKey({ root: '/repo', rev: 'HEAD' })).toBe(
      requestKey({ root: '/repo', rev: 'HEAD' }),
    );
  });

  it('separates every field that changes what a run does', () => {
    const base = { root: '/repo' };
    const keys = [
      requestKey(base),
      requestKey({ ...base, rev: 'v1.0.0' }),
      requestKey({ ...base, historyLimit: 500 }),
      requestKey({ ...base, paths: ['src'] }),
      requestKey({ ...base, ignore: ['dist'] }),
      requestKey({ ...base, languages: ['language-typescript'] }),
      requestKey({ ...base, metrics: ['git-hotspots'] }),
      requestKey({ ...base, convention: 'commit-conventional' }),
      requestKey({ ...base, cache: false }),
      requestKey({ root: '/other' }),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps "every plugin" apart from "no plugin"', () => {
    // `null` runs all of them and `[]` runs none; joining those two requests
    // would hand one caller the other's answer.
    expect(requestKey({ root: '/repo', languages: null })).not.toBe(
      requestKey({ root: '/repo', languages: [] }),
    );
  });

  it('does not confuse two lists that concatenate alike', () => {
    expect(requestKey({ root: '/repo', paths: ['a b', 'c'] })).not.toBe(
      requestKey({ root: '/repo', paths: ['a', 'b c'] }),
    );
  });
});
