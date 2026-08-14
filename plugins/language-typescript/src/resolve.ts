import { dirname, extname, join, normalize } from 'node:path';
import type { RepoFile } from '@strata/sdk';
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
 * Resolve a relative import specifier to a known file path. Anything else is a
 * package: `utils/helper` names a dependency, never the `utils/helper.ts` next
 * door, so bare specifiers are not tried against the file set.
 */
export function resolveLocal(
  from: RepoFile,
  spec: string,
  byPath: Map<string, RepoFile>,
): string | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = normalize(join(dirname(from.path), spec)).replaceAll('\\', '/');
  return candidatePaths(base).find((c) => byPath.has(c));
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
 * Resolve everything one file imports. Specifiers that point outside the run —
 * packages, assets, files the ignore rules dropped — simply fall away; they are
 * not edges, and the dependency pass reads the raw specifiers anyway.
 */
export function resolveImports(
  file: RepoFile,
  scan: FileScan,
  byPath: Map<string, RepoFile>,
): ResolvedImports {
  const uses: ResolvedUse[] = [];
  for (const site of scan.imports) {
    const to = resolveLocal(file, site.spec, byPath);
    if (to) uses.push({ to, names: site.names, namespace: site.namespace });
  }

  const stars: string[] = [];
  for (const spec of scan.stars) {
    const to = resolveLocal(file, spec, byPath);
    if (to) stars.push(to);
  }

  return { uses, stars };
}
