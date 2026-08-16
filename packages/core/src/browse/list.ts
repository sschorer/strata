import { access, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  allowedDirectory,
  resolveRoots,
  RootDeniedError,
  withinRoots,
} from '../roots/index.js';
import type { BrowseOptions, DirectoryEntry, DirectoryListing } from './types.js';

/**
 * List a directory for the folder picker: its subdirectories, which of them
 * are git working trees, and the way back up.
 *
 * Directory names only — never a file, never any content. What it may reach is
 * `roots/`'s decision, and the path is resolved through symlinks *before* it
 * is checked, so a link inside a root cannot step outside one.
 */
export async function listDirectory(
  options: BrowseOptions = {},
): Promise<DirectoryListing> {
  const roots = options.roots ?? (await resolveRoots());
  const requested = options.path ?? roots[0];
  if (!requested) {
    // Nothing is browsable: no root exists. An empty listing says so without
    // pretending the request was wrong.
    return { path: '', parent: null, repo: false, entries: [], roots: [] };
  }

  const path = await allowedDirectory(requested, roots);

  const parent = dirname(path);
  return {
    path,
    // The way up stops at a root: above it is not browsable, so offering it
    // would be a link to a 403.
    parent: parent !== path && withinRoots(parent, roots) ? parent : null,
    repo: await isRepo(path),
    entries: await children(path, options.hidden ?? false),
    roots,
  };
}

async function children(
  path: string,
  hidden: boolean,
): Promise<DirectoryEntry[]> {
  let names: string[];
  try {
    const found = await readdir(path, { withFileTypes: true });
    names = found
      // A symlink is resolved below; anything that is not a directory in the
      // end is simply not listed.
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .filter((name) => hidden || !name.startsWith('.'));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') throw new RootDeniedError(path);
    throw err;
  }

  const entries = await Promise.all(
    names.map(async (name) => {
      const child = join(path, name);
      // A dangling link, a directory that vanished between the two calls, or
      // one this process may not stat: it is simply not offered.
      if (!(await directory(child))) return null;
      return { name, path: child, repo: await isRepo(child) };
    }),
  );

  return entries
    .filter((entry): entry is DirectoryEntry => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

async function directory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * A working-tree root carries `.git` — a directory normally, a *file* in a
 * worktree or a submodule, so existence is the test. It is a hint for the
 * picker, not a decision: registering resolves the path through git anyway,
 * which is what turns a subdirectory into the repository it belongs to.
 */
async function isRepo(path: string): Promise<boolean> {
  try {
    await access(join(path, '.git'));
    return true;
  } catch {
    return false;
  }
}
