import type { RepoFile, StageFilter } from '@strata/sdk';
import { claimedFiles, globMatcher } from '../scope/index.js';

/**
 * The files a stage's filter matched — by extension, by glob, or by either.
 *
 * Applied here rather than inside the stage, so that the files a stage sees and
 * the files its cache key digests are the same set by construction: a stage
 * left to filter for itself would force the key to cover the whole tree, and a
 * README edit would invalidate a TypeScript graph on a 50k-file repository
 * (`docs/adr/0010`).
 *
 * The two halves are a union, not an intersection — a filter naming `py` and
 * `proto/**\/*.proto` wants both, which is the only reading under which naming
 * a second thing can add files rather than take them away.
 */
export function matchedFiles(
  files: readonly RepoFile[],
  filter: StageFilter,
): RepoFile[] {
  const byGlob = globMatcher(filter.globs);
  const byExtension = new Set(
    claimedFiles(files, filter.extensions ?? []).map((file) => file.path),
  );
  return files.filter(
    (file) => byExtension.has(file.path) || byGlob?.(file.path) === true,
  );
}
