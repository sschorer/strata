import type { RepoContext } from '@strata/sdk';
import { parseManifest, type PackageManifest } from './manifest.js';

/**
 * Read every `package.json` tracked at the analysed revision.
 *
 * They are not part of `ctx.files` — the core hands a language plugin only the
 * files matching its extensions — so they come straight from git. Reading the
 * revision rather than the working tree keeps the answer consistent with the
 * rest of the analysis.
 */
export async function readManifests(
  ctx: RepoContext,
): Promise<PackageManifest[]> {
  let listing: string;
  try {
    // -z: NUL-separated, so paths with spaces or non-ASCII arrive unquoted.
    listing = await ctx.git(['ls-tree', '-r', '--name-only', '-z', ctx.rev]);
  } catch (error) {
    ctx.log.warn('could not list files; skipping dependency analysis', error);
    return [];
  }

  const manifests: PackageManifest[] = [];
  for (const path of listing.split('\0')) {
    if (!isManifestPath(path)) continue;
    try {
      const text = await ctx.git(['show', `${ctx.rev}:${path}`]);
      const manifest = parseManifest(path, text);
      if (manifest) manifests.push(manifest);
    } catch (error) {
      ctx.log.warn(`could not read ${path}`, error);
    }
  }
  return manifests;
}

function isManifestPath(path: string): boolean {
  if (path !== 'package.json' && !path.endsWith('/package.json')) return false;
  return !path.includes('node_modules/');
}
