import { realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, resolve } from 'node:path';

/**
 * Where Strata may reach on disk. The server user's home by default — that is
 * where repositories live on a workstation — and `$STRATA_ROOTS`
 * (`PATH`-separated) for anything else: `/repos` in the container, a scratch
 * disk, a second checkout area. `$STRATA_ROOTS=/` opts out of the confinement
 * entirely, for a deployment that would rather trust its callers.
 *
 * This is the whole of the sandbox: the API browses directory *names*, walks
 * repositories and registers them for whoever can reach it, so what it can
 * reach is a deployment decision rather than "wherever the process happens to
 * have read access".
 *
 * `$STRATA_BROWSE_ROOTS` is the name this had while it confined the folder
 * picker alone; it is still read, so an existing deployment keeps working.
 */
export function configuredRoots(
  configured: string | undefined = process.env.STRATA_ROOTS ??
    process.env.STRATA_BROWSE_ROOTS,
): string[] {
  const named = (configured ?? '')
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const paths = named.length > 0 ? named : [homedir()];
  return [...new Set(paths.map((path) => resolve(path)))];
}

/**
 * The roots as they actually are on disk: resolved through symlinks, and
 * without the ones that are not there. A root that does not exist is dropped
 * rather than reported — `/repos` unmounted is a deployment that reaches
 * nothing, not a broken request — and an empty result says exactly that.
 */
export async function resolveRoots(
  configured?: string | undefined,
): Promise<string[]> {
  const resolved = await Promise.all(
    configuredRoots(configured).map(async (path) => {
      try {
        const real = await realpath(path);
        return (await stat(real)).isDirectory() ? real : null;
      } catch {
        return null;
      }
    }),
  );
  return [...new Set(resolved.filter((path): path is string => path !== null))];
}
