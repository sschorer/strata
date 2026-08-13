import type { RepoFile } from '@strata/sdk';

/**
 * What we extract from one file — cached per blob, so unchanged files are free.
 * Only contents-derived data belongs here; resolving a specifier needs the
 * whole file set and must stay outside the cached value.
 */
export interface FileScan {
  loc: number;
  /** Relative import specifiers, unresolved. */
  specs: string[];
}

const IMPORT_RE =
  /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Read a file once and pull out everything that depends on its contents alone. */
export async function scan(file: RepoFile): Promise<FileScan> {
  const text = await file.read();
  const specs: string[] = [];
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (spec?.startsWith('.')) specs.push(spec); // skip bare/pkg imports
  }
  return { loc: text.split('\n').length, specs };
}
