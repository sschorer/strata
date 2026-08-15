import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DuplicateRootError,
  memoryProjectStore,
  openProjectStore,
  type ProjectAnalysis,
} from './index.js';

/**
 * The registry is the one thing here nobody can recompute: a lost cache costs a
 * rerun, a lost project costs the user their setup. So the interesting cases
 * are the ones that would drop or duplicate an entry.
 */

const analysis: ProjectAnalysis = {
  rev: '4c1249e',
  branch: 'main',
  files: 42,
  durationMs: 1820,
  finishedAt: '2026-08-15T10:00:00.000Z',
};

describe('project store', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'strata-projects-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps registered projects across restarts', () => {
    const store = openProjectStore({ dir });
    const added = store.add({ name: 'Strata', root: '/repos/strata' });

    expect(added).toMatchObject({
      id: 'strata',
      name: 'Strata',
      root: resolve('/repos/strata'),
      lastAnalysis: null,
    });
    store.close();

    const reopened = openProjectStore({ dir });
    expect(reopened.list()).toEqual([added]);
    expect(reopened.get('strata')).toEqual(added);
    reopened.close();
  });

  it('remembers the last analysis of a project', () => {
    const store = openProjectStore({ dir });
    const { id } = store.add({ name: 'Strata', root: '/repos/strata' });

    expect(store.recordAnalysis(id, analysis)?.lastAnalysis).toEqual(analysis);
    store.close();

    const reopened = openProjectStore({ dir });
    expect(reopened.get(id)?.lastAnalysis).toEqual(analysis);
    reopened.close();
  });

  it('has nothing to record for an unknown project', () => {
    const store = openProjectStore({ dir });
    expect(store.recordAnalysis('nope', analysis)).toBeUndefined();
    store.close();
  });

  it('refuses a root that is already registered, however it is spelled', () => {
    const store = openProjectStore({ dir });
    const first = store.add({ name: 'Strata', root: '/repos/strata' });

    const err = catchError(() =>
      store.add({ name: 'Strata again', root: '/repos/strata/' }),
    );

    expect(err).toBeInstanceOf(DuplicateRootError);
    expect((err as DuplicateRootError).existing).toEqual(first);
    expect(store.list()).toHaveLength(1);
    store.close();
  });

  it('gives two projects of the same name distinct ids', () => {
    const store = openProjectStore({ dir });

    expect(store.add({ name: 'Strata', root: '/repos/a' }).id).toBe('strata');
    expect(store.add({ name: 'Strata', root: '/repos/b' }).id).toBe('strata-2');
    store.close();
  });

  it('finds the project registered for a root', () => {
    const store = openProjectStore({ dir });
    const project = store.add({ name: 'Strata', root: '/repos/strata' });

    expect(store.findByRoot('/repos/strata')).toEqual(project);
    expect(store.findByRoot('/repos/other')).toBeUndefined();
    store.close();
  });

  it('rejects a project without a name or a root', () => {
    const store = openProjectStore({ dir });

    expect(() => store.add({ name: '  ', root: '/repos/a' })).toThrow(/name/);
    expect(() => store.add({ name: 'Strata', root: ' ' })).toThrow(/root/);
    store.close();
  });

  it('removes only the entry, and reports an id it did not hold', () => {
    const store = openProjectStore({ dir });
    store.add({ name: 'Strata', root: '/repos/strata' });
    store.add({ name: 'Other', root: '/repos/other' });

    expect(store.remove('strata')).toBe(true);
    expect(store.remove('strata')).toBe(false);
    expect(store.list().map((p) => p.id)).toEqual(['other']);
    store.close();
  });

  it('lists projects in registration order', () => {
    const store = openProjectStore({ dir });
    store.add({ name: 'Zulu', root: '/repos/z' });
    store.add({ name: 'Alpha', root: '/repos/a' });

    expect(store.list().map((p) => p.id)).toEqual(['zulu', 'alpha']);
    store.close();
  });

  it('falls back to memory when the database cannot be opened', () => {
    // A directory where the file has to be: opening it as a database fails.
    const store = openProjectStore({
      path: dir,
      log: { debug() {}, info() {}, warn() {}, error() {} },
    });

    expect(store.path).toBeNull();
    expect(store.add({ name: 'Strata', root: '/repos/strata' }).id).toBe(
      'strata',
    );
    store.close();
  });
});

describe('memory project store', () => {
  it('behaves like the persistent one, minus the file', () => {
    const store = memoryProjectStore();
    const project = store.add({ name: 'Strata', root: '/repos/strata' });

    expect(store.path).toBeNull();
    expect(store.list()).toEqual([project]);
    expect(store.recordAnalysis(project.id, analysis)?.lastAnalysis).toEqual(
      analysis,
    );
    expect(store.findByRoot('/repos/strata')?.id).toBe(project.id);
    expect(() =>
      store.add({ name: 'Twice', root: '/repos/strata' }),
    ).toThrow(DuplicateRootError);
    expect(store.remove(project.id)).toBe(true);
    expect(store.list()).toEqual([]);
  });
});

function catchError(fn: () => unknown): unknown {
  try {
    fn();
    return undefined;
  } catch (err) {
    return err;
  }
}
