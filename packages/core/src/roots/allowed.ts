import { realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveRoots } from './config.js';
import { NoSuchDirectoryError, RootDeniedError } from './errors.js';
import { withinRoots } from './within.js';

/**
 * A directory as it is on disk, once it is known to be inside the roots — what
 * every caller that takes a path from a request should hand on instead of the
 * path it was given.
 *
 * Symlinks are followed *before* the check, so a link inside a root cannot step
 * outside one, and the resolved path is what comes back: whoever asked ends up
 * reading exactly what was checked.
 */
export async function allowedDirectory(
  path: string,
  roots?: readonly string[],
): Promise<string> {
  const allowed = roots ?? (await resolveRoots());

  let real: string;
  try {
    real = await realpath(path);
  } catch (err) {
    // Unreadable is "not yours to reach", like anything else outside.
    if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      throw new RootDeniedError(path);
    }
    // Nothing is there to resolve, so nothing can show the path is inside a
    // root. Where it would lie inside one anyway, "not a directory" is the
    // honest answer; anywhere else it gets the refusal every outside path
    // gets, so this never becomes a way to ask what exists elsewhere on disk.
    if (withinRoots(resolve(path), allowed)) {
      throw new NoSuchDirectoryError(path);
    }
    throw new RootDeniedError(path);
  }

  if (!withinRoots(real, allowed)) throw new RootDeniedError(path);

  try {
    if (!(await stat(real)).isDirectory()) throw new NoSuchDirectoryError(path);
  } catch (err) {
    if (err instanceof NoSuchDirectoryError) throw err;
    throw new RootDeniedError(path);
  }
  return real;
}
