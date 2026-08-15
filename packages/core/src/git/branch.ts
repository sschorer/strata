import { git } from './exec.js';

const HEADS = 'refs/heads/';

/**
 * The branch `rev` names, or null when it names none. A detached HEAD, a raw
 * sha, a tag and a remote-tracking ref all analyse fine — they simply have no
 * local branch to show in the run header.
 */
export async function branchAt(
  root: string,
  rev = 'HEAD',
): Promise<string | null> {
  // `--symbolic-full-name` prints the full ref a revision resolves to: a branch
  // as `refs/heads/<name>`, a detached HEAD as `HEAD`, a raw sha as nothing.
  const ref = (
    await git(root, ['rev-parse', '--symbolic-full-name', rev])
  ).trim();
  return ref.startsWith(HEADS) ? ref.slice(HEADS.length) : null;
}
