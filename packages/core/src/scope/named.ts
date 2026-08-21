import type { LoadedPlugin } from '../registry.js';
import { MissingPluginError, type NamedBy } from './errors.js';

/**
 * Hold what a setting names to what this workbench loaded, and fail the run if
 * any of it is missing.
 *
 * One rule, one place, for every setting that names a plugin — the failure has
 * to be the same wherever configuration comes from, so that a run in CI and a
 * run in the workbench either both succeed or both say the same thing about
 * why they did not.
 *
 * Naming nothing is not a selection: `null` and `undefined` mean "every
 * registered plugin of this kind", which is what an unconfigured project asks
 * for and has nothing to check.
 */
export function requireLoaded(
  loaded: readonly LoadedPlugin[],
  named: readonly string[] | string | null | undefined,
  by: NamedBy,
): void {
  if (named === null || named === undefined) return;

  const known = loaded.map((entry) => entry.manifest.id);
  const ids = typeof named === 'string' ? [named] : named;
  const missing = ids.filter((id) => !known.includes(id));
  if (missing.length === 0) return;

  throw new MissingPluginError(by, missing, known);
}
