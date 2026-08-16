/**
 * A path outside the browse roots, or one the server may not read. Both are
 * the same answer to a caller — *not yours to look at* — and deliberately do
 * not say which: distinguishing them would confirm that a path exists.
 */
export class BrowseDeniedError extends Error {
  constructor(path: string) {
    super(`${path} is not inside a directory Strata may browse.`);
    this.name = 'BrowseDeniedError';
  }
}

/** The path is not there, or is not a directory. */
export class NoSuchDirectoryError extends Error {
  constructor(path: string) {
    super(`${path} is not a directory.`);
    this.name = 'NoSuchDirectoryError';
  }
}
