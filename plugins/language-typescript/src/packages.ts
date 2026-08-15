import type { RepoFile } from '@strata/sdk';
import type { PackageManifest } from './manifest.js';
import { candidatePaths } from './resolve.js';

/** A package that lives in this repository, and the directory it governs. */
export interface WorkspacePackage {
  name: string;
  /** Repo-relative directory of its `package.json`; `''` at the root. */
  dir: string;
}

/**
 * The packages the repository publishes, longest name first so `@strata/sdk`
 * is matched before a hypothetical `@strata`.
 */
export function workspacePackages(
  manifests: readonly PackageManifest[],
): WorkspacePackage[] {
  return manifests
    .filter((manifest): manifest is PackageManifest & { name: string } =>
      Boolean(manifest.name),
    )
    .map((manifest) => ({ name: manifest.name, dir: manifest.dir }))
    .sort((a, b) => b.name.length - a.name.length);
}

/**
 * Resolve a specifier that names one of the repository's own packages.
 *
 * In a workspace, `packages/core` imports `@strata/sdk` — not `../sdk/src`.
 * Node resolves that through a `node_modules` symlink to the *built* output,
 * which is not in the repository, so relative resolution alone sees no edge at
 * all and every package looks like an island. Reading the workspace manifests
 * gives the missing half: the name maps to a directory, and the source behind
 * the published entry is the conventional `src/index` (or an `index` beside
 * the manifest), which is what the graph should point at.
 *
 * The built entry itself (`dist/index.js`) is deliberately not followed: it is
 * not tracked, and an edge into a build artefact is not an edge a reader can
 * act on.
 */
export function resolveWorkspace(
  spec: string,
  packages: readonly WorkspacePackage[],
  byPath: ReadonlyMap<string, RepoFile>,
): string | undefined {
  const owner = packages.find(
    (pkg) => spec === pkg.name || spec.startsWith(`${pkg.name}/`),
  );
  if (!owner) return undefined;

  const subpath = spec.slice(owner.name.length).replace(/^\//, '');
  const stem = subpath === '' ? 'index' : subpath;
  const bases = [
    join(owner.dir, 'src', stem),
    join(owner.dir, stem),
    ...(subpath === '' ? [] : [join(owner.dir, 'src', subpath, 'index')]),
  ];

  for (const base of bases) {
    const found = candidatePaths(base).find((candidate) =>
      byPath.has(candidate),
    );
    if (found) return found;
  }
  return undefined;
}

/** POSIX join that keeps repo-relative paths repo-relative. */
function join(dir: string, ...rest: string[]): string {
  return [dir, ...rest].filter(Boolean).join('/');
}
