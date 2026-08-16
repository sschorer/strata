import type { RepoFile } from '@strata/sdk';
import { globMatcher } from './glob.js';

/** The part of a repository a run looks at, as a project's config states it. */
export interface FileScope {
  /**
   * Repo-relative paths (or globs) to analyse; empty means the whole
   * repository.
   */
  paths?: readonly string[] | null;
  /** Globs taken back out of it. */
  ignore?: readonly string[] | null;
}

/**
 * Narrow the tracked files to the ones a project's scope names: `paths` says
 * what is looked at at all, `ignore` takes back out of it, in that order — a
 * project that analyses `src` and ignores generated code gets neither `docs/`
 * nor `src/schema.generated.ts`.
 *
 * Routing happens once, here, rather than inside each plugin. Scope is a
 * property of the project rather than of any one analysis, and a plugin left to
 * re-apply it could disagree with the file count the run reports — or forget.
 */
export function scopedFiles(
  files: readonly RepoFile[],
  scope: FileScope = {},
): RepoFile[] {
  const included = globMatcher(scope.paths);
  const excluded = globMatcher(scope.ignore);
  if (!included && !excluded) return [...files];
  return files.filter(
    (file) =>
      (!included || included(file.path)) && !excluded?.(file.path),
  );
}
