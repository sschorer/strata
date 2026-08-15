import { resolve } from 'node:path';
import { createConsoleLogger } from '../logger.js';
import { memorySettingsStore } from './memory.js';
import { SqliteSettingsStore } from './sqlite.js';
import type { SettingsStore, SettingsStoreOptions } from './types.js';

/** Beside `projects.db`, in the directory that is already a persisted volume. */
const DEFAULT_DIR = '.strata';

/**
 * Open the app settings. Never throws at startup: a location that cannot be
 * opened (read-only container, missing permissions, a file from a newer build)
 * degrades to in-memory settings and a warning, so the workbench still runs on
 * its defaults — it simply forgets a change when the process exits.
 *
 * Writes on an opened store do *not* degrade; see `sqlite.ts`.
 */
export function openSettingsStore(
  opts: SettingsStoreOptions = {},
): SettingsStore {
  const log = opts.log ?? createConsoleLogger('strata:settings');
  const file =
    opts.path ??
    resolve(
      opts.dir ?? process.env.STRATA_DATA_DIR ?? DEFAULT_DIR,
      'settings.db',
    );
  try {
    return new SqliteSettingsStore(file, log);
  } catch (err) {
    log.warn(
      `not persisted — could not open ${file}: ${(err as Error).message}`,
    );
    return memorySettingsStore();
  }
}
