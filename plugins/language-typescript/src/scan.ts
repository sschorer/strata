import type { RepoFile } from '@strata/sdk';
import { blankComments } from './comments.js';
import { cyclomaticComplexity } from './complexity.js';
import { parseExports, type ExportSite } from './exports.js';
import { fingerprint, type Fingerprint } from './fingerprint.js';
import { parseImports, type ImportSite } from './imports.js';
import { maxNesting } from './nesting.js';
import { withSyntaxTree } from './parser.js';

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

/**
 * Read a file once and pull out everything that depends on its contents alone.
 *
 * One parse feeds every pass. The syntax tree is the expensive part — the five
 * readers below are walks over it — and it lives only for the length of this
 * call, so a repository is never more than one tree in memory at a time.
 */
export async function scan(file: RepoFile): Promise<FileScan> {
  const text = await file.read();

  return withSyntaxTree(file.path, text, (root) => {
    const { exports, uses, stars } = parseExports(root);
    return {
      loc: text.split('\n').length,
      // A re-export takes names out of another module as much as an import
      // does; the export parser is simply the one that already saw it.
      imports: [...parseImports(root), ...uses],
      exports,
      stars,
      complexity: cyclomaticComplexity(root),
      nesting: maxNesting(root),
      fingerprint: fingerprint(blankComments(root, text)),
    };
  });
}
