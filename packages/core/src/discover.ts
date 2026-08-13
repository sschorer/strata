import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { MANIFEST_FILENAME } from './manifest.js';

/**
 * List the manifests of every plugin installed in a plugins directory: one
 * plugin per immediate subdirectory, holding a `strata.plugin.json`.
 *
 * A directory that does not exist yields nothing rather than throwing — most
 * installs never drop a third-party plugin in, and that is not an error. Paths
 * come back sorted so load order (and therefore which plugin wins an id clash)
 * does not depend on the filesystem.
 */
export async function discoverPlugins(dir: string): Promise<string[]> {
  const root = resolve(dir);
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new Error(
      `plugins directory ${root} is not readable: ${(err as Error).message}`,
      { cause: err },
    );
  }

  const manifests: string[] = [];
  for (const name of entries.sort()) {
    // Testing for the manifest is the whole check: it filters stray files and
    // follows a symlinked plugin directory, which is how you develop against a
    // checkout without copying it in.
    const manifestPath = join(root, name, MANIFEST_FILENAME);
    if (await isFile(manifestPath)) manifests.push(manifestPath);
  }
  return manifests;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
