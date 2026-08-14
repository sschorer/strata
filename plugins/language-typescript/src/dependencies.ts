import { builtinModules } from 'node:module';
import type { DeadCodeFinding } from '@strata/sdk';
import type { PackageManifest } from './manifest.js';

/** What the dependency pass asks of a file: every specifier, as written. */
export interface FileSpecs {
  path: string;
  specs: readonly string[];
}

const BUILTINS = new Set(builtinModules);

/**
 * Declared dependencies that nothing in the package imports.
 *
 * Scoped per package: a dependency belongs to the `package.json` nearest above
 * the file that imports it, so in a workspace a package cannot borrow its
 * neighbour's declaration to look used.
 *
 * Only `dependencies` are checked. `devDependencies` are mostly things nobody
 * imports on purpose — the compiler, the test runner, lint plugins, type
 * packages — and reporting them would be noise, not dead code. `@types/*` is
 * skipped for the same reason wherever it is declared: it is consumed by the
 * type checker, never by an import.
 */
export function unusedDependencies(
  manifests: readonly PackageManifest[],
  files: readonly FileSpecs[],
): DeadCodeFinding[] {
  if (manifests.length === 0) return [];

  // Longest directory first, so the nearest package.json wins.
  const dirs = manifests
    .map((m) => m.dir)
    .sort((a, b) => b.length - a.length);
  const importedBy = new Map<string, Set<string>>();

  for (const file of files) {
    const dir = dirs.find((d) => d === '' || file.path.startsWith(`${d}/`));
    if (dir === undefined) continue;
    let names = importedBy.get(dir);
    if (!names) importedBy.set(dir, (names = new Set()));
    for (const spec of file.specs) {
      const name = packageName(spec);
      if (name) names.add(name);
    }
  }

  const findings: DeadCodeFinding[] = [];
  for (const manifest of manifests) {
    const imported = importedBy.get(manifest.dir);
    for (const dep of manifest.dependencies) {
      if (imported?.has(dep.name) || dep.name.startsWith('@types/')) continue;
      findings.push({
        path: manifest.path,
        symbol: dep.name,
        ...(dep.line === undefined ? {} : { line: dep.line }),
        reason: 'unused-dependency',
      });
    }
  }
  return findings;
}

/**
 * The package a specifier names: `lodash/merge` → `lodash`, `@scope/a/b` →
 * `@scope/a`. Relative paths, absolute paths, Node built-ins and `#private`
 * subpath imports name no package.
 */
export function packageName(spec: string): string | undefined {
  if (/^[./#]/.test(spec) || spec.startsWith('node:')) return undefined;
  const parts = spec.split('/');
  const name = spec.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : parts[0];
  if (!name || BUILTINS.has(name)) return undefined;
  return name;
}
