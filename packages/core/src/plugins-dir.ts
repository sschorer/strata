import { resolve } from 'node:path';

/**
 * Default location, relative to the working directory — in the container that
 * is `/app/.strata/plugins`, inside the volume that already survives restarts.
 */
const DEFAULT_DIR = '.strata/plugins';

/**
 * Where drop-in third-party plugins live: `STRATA_PLUGINS_DIR`, else
 * `<cwd>/.strata/plugins`. Always absolute, and not required to exist — the
 * loader treats a missing directory as "no third-party plugins installed".
 *
 * Surfaced in the UI as *Settings → Plugins & engine → Plugins directory*.
 */
export function userPluginsDir(): string {
  const configured = process.env.STRATA_PLUGINS_DIR?.trim();
  return resolve(configured || DEFAULT_DIR);
}
