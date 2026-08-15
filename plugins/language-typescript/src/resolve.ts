import { dirname, extname, join, normalize } from 'node:path';
import type { RepoFile } from '@strata/sdk';
import { aliasBases, type AliasScope } from './aliases.js';
import { resolveWorkspace, type WorkspacePackage } from './packages.js';
import type { FileScan } from './scan.js';

/** Extensions this module claims, in the order a resolver should try them. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * A NodeNext codebase imports `./x.js` and ships `x.ts`: the specifier names
 * the *output*, the repository holds the input. Without this mapping a
 * correctly written ESM+TypeScript project resolves to nothing at all.
 */
const SOURCE_OF: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

/** Where a local module might live, most specific first. */
export function candidatePaths(base: string): string[] {
  const ext = extname(base);
  if (!ext) {
    return [
      ...EXTENSIONS.map((e) => `${base}${e}`),
      ...EXTENSIONS.map((e) => `${base}/index${e}`),
    ];
  }
  const stem = base.slice(0, -ext.length);
  return [base, ...(SOURCE_OF[ext] ?? []).map((e) => `${stem}${e}`)];
}

/**
 * Resolve an import specifier to a known file path.
 *
 * A relative specifier is read from the importing file's directory. Anything
 * else is a package — `utils/helper` names a dependency, never the
 * `utils/helper.ts` next door — *unless* the project declares otherwise:
 * `compilerOptions.paths` and `baseUrl` are how a repository says that
 * `@app/user` is one of its own files, so those are tried before giving up.
 */
export function resolveLocal(
  from: RepoFile,
  spec: string,
  byPath: Map<string, RepoFile>,
  scopes: readonly AliasScope[] = [],
): string | undefined {
  const bases = spec.startsWith('.')
    ? [join(dirname(from.path), spec)]
    : aliasBases(scopes, from.path, spec);

  for (const base of bases) {
    const found = candidatePaths(
      normalize(base).replaceAll('\\', '/'),
    ).find((c) => byPath.has(c));
    if (found) return found;
  }
  return undefined;
}

/** A local module a file takes names from, with the specifier resolved away. */
export interface ResolvedUse {
  /** Repo-relative path of the imported file. */
  to: string;
  names: string[];
  namespace: boolean;
}

/** One file's specifiers, mapped onto the files the run actually sees. */
export interface ResolvedImports {
  uses: ResolvedUse[];
  /** Resolved `export * from` targets. */
  stars: string[];
}

/**
 * Resolve everything one file imports.
 *
 * A specifier that names a file in the run is an edge. So is one that names a
 * package *this repository publishes* — resolved through the workspace
 * manifests, because `packages/core` says `@strata/sdk` rather than
 * `../sdk/src`, and without that every package in a monorepo looks like an
 * island. Everything else points outside the run — a third-party package, an
 * asset, a file the ignore rules dropped — and simply falls away; it is not an
 * edge, and the dependency pass reads the raw specifiers anyway.
 */
export function resolveImports(
  file: RepoFile,
  scan: FileScan,
  byPath: Map<string, RepoFile>,
  scopes: readonly AliasScope[] = [],
  packages: readonly WorkspacePackage[] = [],
): ResolvedImports {
  const uses: ResolvedUse[] = [];

  const resolve = (spec: string): string | undefined =>
    resolveLocal(file, spec, byPath, scopes) ??
    resolveWorkspace(spec, packages, byPath);

  for (const site of scan.imports) {
    const to = resolve(site.spec);
    if (to) uses.push({ to, names: site.names, namespace: site.namespace });
  }

  const stars: string[] = [];
  for (const spec of scan.stars) {
    const to = resolve(spec);
    if (to) stars.push(to);
  }

  return { uses, stars };
}
