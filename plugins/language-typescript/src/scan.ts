import type { RepoFile } from '@strata/sdk';
import { cyclomaticComplexity } from './complexity.js';
import { fingerprint, type Fingerprint } from './fingerprint.js';
import { maxNesting } from './nesting.js';
import { stripComments, stripNonCode } from './strip.js';

/**
 * What we extract from one file — cached per blob, so unchanged files are free.
 * Only contents-derived data belongs here; resolving a specifier and comparing
 * fingerprints both need the whole file set and must stay outside the cached
 * value.
 */
export interface FileScan {
  loc: number;
  /** Relative import specifiers, unresolved. */
  specs: string[];
  /** McCabe cyclomatic complexity of the whole file. */
  complexity: number;
  /** Deepest nesting of control-flow blocks. */
  nesting: number;
  /** Window hashes, for the cross-file duplication pass. */
  fingerprint: Fingerprint;
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

  // Specifiers live *in* string literals, so they are read from the raw text.
  // The metrics each get the text stripped the way they need it: counting
  // syntax means dropping literals, comparing code means keeping them.
  const code = stripNonCode(text);
  return {
    loc: text.split('\n').length,
    specs,
    complexity: cyclomaticComplexity(code),
    nesting: maxNesting(code),
    fingerprint: fingerprint(stripComments(text)),
  };
}
