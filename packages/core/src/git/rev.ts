import { git } from './exec.js';

/** Resolve a revision (branch/tag/HEAD) to a concrete commit sha. */
export async function resolveRev(root: string, rev = 'HEAD'): Promise<string> {
  return (await git(root, ['rev-parse', rev])).trim();
}
