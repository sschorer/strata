import type { RepoContext } from '@strata/sdk';
import { parseManifest, type PackageManifest } from './manifest.js';
import { readTracked } from './tracked.js';

/**
 * Read every `package.json` among `paths` at the analysed revision — the
 * entry points and declared dependencies the dead-code passes hang off.
 */
export async function readManifests(
  ctx: RepoContext,
  paths: readonly string[],
): Promise<PackageManifest[]> {
  const manifests: PackageManifest[] = [];

  for (const path of paths) {
    if (!isManifestPath(path)) continue;
    const text = await readTracked(ctx, path);
    if (text === undefined) continue;
    const manifest = parseManifest(path, text);
    if (manifest) manifests.push(manifest);
  }

  return manifests;
}

function isManifestPath(path: string): boolean {
  if (path !== 'package.json' && !path.endsWith('/package.json')) return false;
  return !path.includes('node_modules/');
}
