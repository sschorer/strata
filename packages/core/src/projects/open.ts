import { resolve } from 'node:path';
import { createConsoleLogger } from '../logger.js';
import { memoryProjectStore } from './memory.js';
import { SqliteProjectStore } from './sqlite.js';
import type { ProjectStore, ProjectStoreOptions } from './types.js';

/** Beside `cache.db`, in the directory that is already a persisted volume. */
const DEFAULT_DIR = '.strata';

/**
 * Open the project registry. Never throws at startup: a location that cannot
 * be opened (read-only container, missing permissions, a file from a newer
 * build) degrades to an in-memory registry and a warning, so the workbench
 * still runs — it simply forgets the list when the process exits.
 *
 * Writes on an opened store do *not* degrade; see `sqlite.ts`.
 */
export function openProjectStore(
  opts: ProjectStoreOptions = {},
): ProjectStore {
  const log = opts.log ?? createConsoleLogger('strata:projects');
  const file =
    opts.path ??
    resolve(
      opts.dir ?? process.env.STRATA_DATA_DIR ?? DEFAULT_DIR,
      'projects.db',
    );
  try {
    return new SqliteProjectStore(file);
  } catch (err) {
    log.warn(
      `not persisted — could not open ${file}: ${(err as Error).message}`,
    );
    return memoryProjectStore();
  }
}
