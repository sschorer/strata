import { dirname, extname, join, normalize } from 'node:path';
import type { RepoFile } from '@strata/sdk';

/** Resolve a relative import specifier to a known file path. */
export function resolveLocal(
  from: RepoFile,
  spec: string,
  byPath: Map<string, RepoFile>,
): string | undefined {
  const base = normalize(join(dirname(from.path), spec)).replaceAll('\\', '/');
  const candidates = extname(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
      ];
  return candidates.find((c) => byPath.has(c));
}
