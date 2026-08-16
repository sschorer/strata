/**
 * A path outside the roots, or one the server may not read. Both are the same
 * answer to a caller — *not yours to reach* — and deliberately do not say
 * which: distinguishing them would confirm that a path exists.
 */
export class RootDeniedError extends Error {
  constructor(path: string) {
    super(`${path} is not inside a directory Strata may reach.`);
    this.name = 'RootDeniedError';
  }
}

/** The path is not there, or is not a directory. */
export class NoSuchDirectoryError extends Error {
  constructor(path: string) {
    super(`${path} is not a directory.`);
    this.name = 'NoSuchDirectoryError';
  }
}
