/**
 * Repo paths are always POSIX-style (git hands them over that way), so a
 * split on `/` is all the view needs to show a file name apart from its
 * directory.
 */

export function fileName(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? path : path.slice(cut + 1);
}

/** The directory, with a trailing slash — empty for a file at the repo root. */
export function dirName(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut + 1);
}
