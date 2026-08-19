import { extname } from 'node:path';
import type { RepoFile } from '@strata/sdk';

/**
 * The files a language plugin claims, by extension. A plugin whose file types
 * this repository does not hold matches nothing and is skipped — which is why
 * the pipeline works this out before it plans a run rather than while it walks
 * one: a plugin that will never be called must not be counted as a step a
 * reader is waiting for.
 */
export function claimedFiles(
  files: readonly RepoFile[],
  extensions: readonly string[],
): RepoFile[] {
  const claimed = new Set(extensions.map((e) => `.${e}`));
  return files.filter((f) => claimed.has(extname(f.path)));
}
