import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RepoFile } from '@strata/sdk';
import { digest, filesDigest, nullCache, openAnalysisCache } from './cache.js';

function file(path: string, blob: string, body = ''): RepoFile {
  return { path, blob, read: async () => body };
}

describe('analysis cache', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'strata-cache-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('computes once per blob and reuses the value afterwards', async () => {
    const cache = openAnalysisCache({ dir });
    const scope = cache.scope('plugin-a', '1.0.0');
    let calls = 0;
    const compute = async (f: RepoFile) => {
      calls++;
      return { loc: f.path.length };
    };

    expect(await scope.file(file('a.ts', 'blob1'), compute)).toEqual({ loc: 4 });
    // Same blob at a different path: still the same content, still one compute.
    expect(await scope.file(file('copy.ts', 'blob1'), compute)).toEqual({
      loc: 4,
    });
    expect(calls).toBe(1);

    cache.close();

    // A fresh process sees the persisted entry.
    const reopened = openAnalysisCache({ dir });
    expect(
      await reopened.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob1'), compute),
    ).toEqual({ loc: 4 });
    expect(calls).toBe(1);
    expect(reopened.stats()).toMatchObject({ hits: 1, misses: 0 });
    reopened.close();
  });

  it('recomputes when the blob, the plugin or its version changes', async () => {
    const cache = openAnalysisCache({ dir });
    let calls = 0;
    const compute = async () => ++calls;

    await cache.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob1'), compute);
    await cache.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob2'), compute);
    await cache.scope('plugin-a', '2.0.0').file(file('a.ts', 'blob1'), compute);
    await cache.scope('plugin-b', '1.0.0').file(file('a.ts', 'blob1'), compute);

    expect(calls).toBe(4);
    expect(cache.stats()).toMatchObject({ hits: 0, misses: 4, writes: 4 });
    cache.close();
  });

  it('stores and returns whole-run results', async () => {
    const cache = openAnalysisCache({ dir });
    expect(cache.getRun('plugin-a', '1.0.0', 'key')).toBeUndefined();

    cache.setRun('plugin-a', '1.0.0', 'key', { cycles: [['a', 'b']] });
    cache.flush();
    cache.close();

    const reopened = openAnalysisCache({ dir });
    expect(reopened.getRun('plugin-a', '1.0.0', 'key')).toEqual({
      cycles: [['a', 'b']],
    });
    // A different plugin version must not read the old result.
    expect(reopened.getRun('plugin-a', '1.1.0', 'key')).toBeUndefined();
    reopened.close();
  });

  it('clears everything on demand', async () => {
    const cache = openAnalysisCache({ dir });
    let calls = 0;
    const compute = async () => ++calls;

    await cache.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob1'), compute);
    cache.setRun('plugin-a', '1.0.0', 'key', 1);
    cache.flush();
    cache.clear();

    expect(cache.getRun('plugin-a', '1.0.0', 'key')).toBeUndefined();
    await cache.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob1'), compute);
    expect(calls).toBe(2);
    cache.close();
  });

  it('prunes entries that have gone cold', async () => {
    const cache = openAnalysisCache({ dir });
    let calls = 0;
    const compute = async () => ++calls;
    await cache.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob1'), compute);
    cache.setRun('plugin-a', '1.0.0', 'key', 1);
    cache.flush();

    cache.prune(0); // everything is now older than the cutoff
    expect(cache.getRun('plugin-a', '1.0.0', 'key')).toBeUndefined();
    await cache.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob1'), compute);
    expect(calls).toBe(2);
    cache.close();
  });

  it('honours the explicit and env-var off switches', async () => {
    const off = openAnalysisCache({ dir, enabled: false });
    expect(off.path).toBeNull();

    process.env.STRATA_CACHE = 'off';
    try {
      const envOff = openAnalysisCache({ dir });
      expect(envOff.path).toBeNull();
    } finally {
      delete process.env.STRATA_CACHE;
    }

    let calls = 0;
    const compute = async () => ++calls;
    await off.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob1'), compute);
    await off.scope('plugin-a', '1.0.0').file(file('a.ts', 'blob1'), compute);
    expect(calls).toBe(2); // a disabled cache is a pass-through
    off.close();
  });

  it('keeps working when the database fails mid-run', async () => {
    const warnings: string[] = [];
    const log = {
      debug: () => {},
      info: () => {},
      warn: (m: string) => warnings.push(m),
      error: () => {},
    };
    const cache = openAnalysisCache({ dir, log });
    // Closing the database makes every later statement throw — the same shape
    // as a full disk or a write lock we never win.
    cache.close();

    let calls = 0;
    const value = await cache
      .scope('plugin-a', '1.0.0')
      .file(file('a.ts', 'blob1'), async () => ++calls);

    expect(value).toBe(1); // the read failure was a miss, not an error
    expect(() => cache.flush()).not.toThrow();
    expect(() => cache.close()).not.toThrow();
    expect(cache.getRun('plugin-a', '1.0.0', 'key')).toBeUndefined();
    // One warning for the whole degraded run, not one per statement.
    expect(warnings).toHaveLength(1);
  });

  it('degrades to a pass-through when the database cannot be opened', () => {
    const warnings: string[] = [];
    const log = {
      debug: () => {},
      info: () => {},
      warn: (m: string) => warnings.push(m),
      error: () => {},
    };
    // A path under a *file* can never be created.
    const cache = openAnalysisCache({
      path: resolve(import.meta.filename, 'nope/cache.db'),
      log,
    });

    expect(cache.path).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(nullCache().path).toBeNull();
  });

  it('digests file sets by content, independent of order', () => {
    const a = [file('a.ts', 'blob1'), file('b.ts', 'blob2')];
    const b = [file('b.ts', 'blob2'), file('a.ts', 'blob1')];
    expect(filesDigest(a)).toBe(filesDigest(b));
    expect(filesDigest(a)).not.toBe(
      filesDigest([file('a.ts', 'blob1'), file('b.ts', 'changed')]),
    );
    // Paths matter too — the same blob moved is a different graph.
    expect(filesDigest(a)).not.toBe(
      filesDigest([file('a.ts', 'blob1'), file('moved.ts', 'blob2')]),
    );
    expect(digest(['x', 1, undefined])).toBe(digest(['x', 1, undefined]));
    expect(digest(['x', 1])).not.toBe(digest(['x', 2]));
  });
});
