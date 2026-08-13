import { createHash } from 'node:crypto';
import type { RepoFile } from '@strata/sdk';

/**
 * Content digest of a file set — `(path, blob)` for every file, order-independent.
 * Two runs with the same digest see byte-identical inputs, which is what makes
 * a whole-run cache entry safe to reuse.
 */
export function filesDigest(files: readonly RepoFile[]): string {
  const hash = createHash('sha256');
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    hash.update(`${f.path}\0${f.blob}\n`);
  }
  return hash.digest('hex');
}

/** Digest of arbitrary key parts, for run keys that mix in more than files. */
export function digest(parts: readonly (string | number | undefined)[]): string {
  const hash = createHash('sha256');
  for (const p of parts) hash.update(`${p ?? ''}\0`);
  return hash.digest('hex');
}
