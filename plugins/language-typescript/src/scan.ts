import type { RepoFile } from '@strata/sdk';
import { cyclomaticComplexity } from './complexity.js';
import { parseExports, type ExportSite } from './exports.js';
import { fingerprint, type Fingerprint } from './fingerprint.js';
import { parseImports, type ImportSite } from './imports.js';
import { maxNesting } from './nesting.js';
import { stripComments, stripNonCode } from './strip.js';

/**
 * What we extract from one file — cached per blob, so unchanged files are free.
 * Only contents-derived data belongs here; resolving a specifier, comparing
 * fingerprints and deciding whether an export is referenced all need the whole
 * file set and must stay outside the cached value.
 */
export interface FileScan {
  loc: number;
  /** Every module the file pulls in, with the names it takes. */
  imports: ImportSite[];
  /** Names the file offers to other modules. */
  exports: ExportSite[];
  /** `export * from` specifiers — names pass through unnamed. */
  stars: string[];
  /** McCabe cyclomatic complexity of the whole file. */
  complexity: number;
  /** Deepest nesting of control-flow blocks. */
  nesting: number;
  /** Window hashes, for the cross-file duplication pass. */
  fingerprint: Fingerprint;
}

/** Read a file once and pull out everything that depends on its contents alone. */
export async function scan(file: RepoFile): Promise<FileScan> {
  const text = await file.read();

  // Each pass gets the text stripped the way it needs it. Counting syntax
  // means dropping literals; comparing code means keeping them; and the
  // import/export parsers need the specifiers, which *are* literals, while
  // still ignoring a commented-out import.
  const code = stripNonCode(text);
  const withoutComments = stripComments(text);
  const { exports, uses, stars } = parseExports(withoutComments);

  return {
    loc: text.split('\n').length,
    imports: [...parseImports(withoutComments), ...uses],
    exports,
    stars,
    complexity: cyclomaticComplexity(code),
    nesting: maxNesting(code),
    fingerprint: fingerprint(withoutComments),
  };
}
