import { realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, resolve, sep } from 'node:path';

/**
 * Where the folder picker may look. The server user's home by default — that
 * is where repositories live on a workstation — and `$STRATA_BROWSE_ROOTS`
 * (`PATH`-separated) for anything else: `/repos` in the container, a scratch
 * disk, a second checkout area.
 *
 * This is the whole of the confinement: the browse endpoint lists directory
 * *names* to whoever can reach the API, so what it can reach is a deployment
 * decision rather than "wherever the process happens to have read access".
 */
export function configuredRoots(
  configured: string | undefined = process.env.STRATA_BROWSE_ROOTS,
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
 * rather than reported — `/repos` unmounted is a deployment that browses
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

/**
 * Whether a *resolved* path is a root or sits inside one. Compared with a
 * separator on the end, so `/repos-private` is not inside `/repos`.
 */
export function withinRoots(path: string, roots: readonly string[]): boolean {
  return roots.some(
    (root) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep),
  );
}
