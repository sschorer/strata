import type { DeadCodeFinding } from '@strata/sdk';
import { unusedDependencies } from './dependencies.js';
import { entryPoints } from './entries.js';
import type { ExportSite } from './exports.js';
import type { PackageManifest } from './manifest.js';
import type { ResolvedUse } from './resolve.js';
import { unreachableFiles } from './unreachable.js';
import { unreferencedExports } from './unreferenced.js';

/** One analysed file: what it offers, what it takes, and where that lands. */
export interface AnalysedFile {
  path: string;
  exports: ExportSite[];
  /** Every specifier as written, packages included. */
  specs: string[];
  /** Local modules it takes names from, resolved to repo paths. */
  uses: ResolvedUse[];
  /** Resolved `export * from` targets. */
  stars: string[];
}

/**
 * The three shapes of dead code the SDK defines, found in one place because
 * they overlap: a file nothing reaches is reported once, not once per export it
 * happens to declare.
 *
 * Everything hangs off the entry points — without a root, "unreachable" and
 * "unreferenced" are meaningless — so a repository with no recognisable entry
 * point gets only the dependency pass, which needs no graph. Reporting nothing
 * is the right answer there; reporting the whole repository would not be.
 */
export function findDeadCode(
  files: readonly AnalysedFile[],
  manifests: readonly PackageManifest[],
): DeadCodeFinding[] {
  const entries = entryPoints(
    files.map((f) => f.path),
    manifests,
  );
  const graphFindings: DeadCodeFinding[] = [];

  if (entries.size > 0) {
    const unreachable = unreachableFiles(files, entries);
    graphFindings.push(
      ...[...unreachable].map(
        (path): DeadCodeFinding => ({ path, reason: 'unreachable-file' }),
      ),
      ...unreferencedExports(files, entries, unreachable),
    );
  }

  return [...graphFindings, ...unusedDependencies(manifests, files)].sort(
    byLocation,
  );
}

/** Stable order — the result is cached and diffed between runs. */
function byLocation(a: DeadCodeFinding, b: DeadCodeFinding): number {
  return (
    a.path.localeCompare(b.path) ||
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.symbol ?? '').localeCompare(b.symbol ?? '')
  );
}
