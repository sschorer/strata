/** Separator for a pair key; a `\0` cannot occur in a git path. */
const KEY_SEP = '\0';

/** How often each file changed, and how often each pair of files changed together. */
export interface CoChanges {
  /** Commits that touched a path. */
  changes: Map<string, number>;
  /** Commits that touched both paths of a pair, keyed by `pairKey`. */
  shared: Map<string, number>;
}

/** Order-independent key for a pair of paths. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}${KEY_SEP}${b}` : `${b}${KEY_SEP}${a}`;
}

/** Split a `pairKey` back into its two paths. */
export function splitPair(key: string): [string, string] {
  const [a, b] = key.split(KEY_SEP);
  return [a!, b!];
}

/**
 * Count per-file changes and per-pair co-changes over the given commits.
 *
 * Commits touching more than `maxFilesPerCommit` files are counted for neither:
 * a sweeping rename or a formatting pass couples everything it touches to
 * everything else, which is noise, and the pair count is quadratic in the
 * commit's size — so one huge commit would otherwise dominate both the result
 * and the runtime.
 */
export function countCoChanges(
  commits: string[][],
  maxFilesPerCommit: number,
): CoChanges {
  const changes = new Map<string, number>();
  const shared = new Map<string, number>();

  for (const files of commits) {
    if (files.length > maxFilesPerCommit) continue;
    for (const path of files) {
      changes.set(path, (changes.get(path) ?? 0) + 1);
    }
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = pairKey(files[i]!, files[j]!);
        shared.set(key, (shared.get(key) ?? 0) + 1);
      }
    }
  }
  return { changes, shared };
}
