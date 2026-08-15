import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from './defaults.js';
import { memorySettingsStore, openSettingsStore } from './index.js';

/**
 * Nothing in here is derived, so the interesting cases are the ones that would
 * lose a change: a restart, a patch that names one section of one screen, and a
 * location that cannot be opened at all.
 */
describe('settings store', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'strata-settings-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('answers with the defaults before anything is configured', () => {
    const store = openSettingsStore({ dir });

    expect(store.get()).toEqual(DEFAULT_APP_SETTINGS);
    expect(store.path).toBe(join(dir, 'settings.db'));
    store.close();
  });

  it('keeps a change across restarts', () => {
    const store = openSettingsStore({ dir });
    store.patch({ appearance: { theme: 'light' } });
    store.patch({
      ai: {
        healthCheckInterval: 15,
        providers: [{ id: 'codex', name: 'Codex', enabled: true }],
      },
    });
    store.close();

    const reopened = openSettingsStore({ dir });
    expect(reopened.get()).toMatchObject({
      appearance: { theme: 'light', density: 'balanced' },
      ai: {
        healthCheckInterval: 15,
        providers: [{ id: 'codex', name: 'Codex', enabled: true }],
      },
    });
    reopened.close();
  });

  it('stores only what was set, so a default that moves still reaches it', () => {
    const store = openSettingsStore({ dir });
    store.patch({ gates: { failOnNewCycles: true } });
    store.close();

    const reopened = openSettingsStore({ dir });
    expect(stored(join(dir, 'settings.db'))).toEqual({
      gates: { failOnNewCycles: true },
    });
    expect(reopened.get().engine).toEqual(DEFAULT_APP_SETTINGS.engine);
    reopened.close();
  });

  it('reads the same settings back from memory as from a file', () => {
    const memory = memorySettingsStore();
    const file = openSettingsStore({ dir });
    const patch = { engine: { cache: false }, gates: { hotspotRegression: 10 } };

    expect(memory.patch(patch)).toEqual(file.patch(patch));
    expect(memory.get()).toEqual(file.get());
    file.close();
    memory.close();
  });

  it('falls back to memory rather than failing when the file cannot be opened', () => {
    // A directory is not a database — the same shape of failure as a read-only
    // container, without needing one.
    const store = openSettingsStore({ path: dir, log: silent });

    expect(store.path).toBeNull();
    expect(store.patch({ appearance: { theme: 'dark' } }).appearance.theme).toBe(
      'dark',
    );
    store.close();
  });

  it('falls back to the defaults on a row it cannot read, and says so', () => {
    const path = join(dir, 'settings.db');
    const store = openSettingsStore({ path });
    store.patch({ appearance: { theme: 'dark' } });
    store.close();
    corrupt(path);

    const warnings: string[] = [];
    const reopened = openSettingsStore({
      path,
      log: { ...silent, warn: (m) => warnings.push(m) },
    });

    expect(reopened.get()).toEqual(DEFAULT_APP_SETTINGS);
    expect(warnings.join()).toContain(path);
    // The next write overwrites the bad row rather than merging into it.
    expect(reopened.patch({ appearance: { theme: 'light' } }).appearance).toEqual(
      { theme: 'light', density: 'balanced' },
    );
    reopened.close();
  });

  it('leaves settings written by a newer Strata alone', () => {
    const path = join(dir, 'settings.db');
    const store = openSettingsStore({ path });
    store.patch({ appearance: { theme: 'dark' } });
    store.close();
    stampSchema(path, 99);

    const reopened = openSettingsStore({ path, log: silent });

    // Degraded to memory: this build's defaults, and the file untouched.
    expect(reopened.path).toBeNull();
    expect(reopened.get()).toEqual(DEFAULT_APP_SETTINGS);
    expect(stored(path)).toEqual({ appearance: { theme: 'dark' } });
    reopened.close();
  });
});

const silent = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

/** The raw row, to assert that only what was set is written down. */
function stored(path: string): unknown {
  const db = new DatabaseSync(path);
  const row = db.prepare('SELECT value FROM settings WHERE id = 1').get() as
    | { value: string }
    | undefined;
  db.close();
  return row === undefined ? undefined : JSON.parse(row.value);
}

/** Whatever left this behind, it is not settings any more. */
function corrupt(path: string): void {
  const db = new DatabaseSync(path);
  db.prepare('UPDATE settings SET value = ? WHERE id = 1').run('{not json');
  db.close();
}

/** Pretend the file was written by a build this one does not understand. */
function stampSchema(path: string, version: number): void {
  const db = new DatabaseSync(path);
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  ).run(String(version));
  db.close();
}
