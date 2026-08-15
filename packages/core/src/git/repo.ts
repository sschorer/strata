import { realpath } from 'node:fs/promises';
import { git } from './exec.js';

/**
 * The working-tree root of the repository `dir` belongs to, or `null` when it
 * belongs to none (or does not exist).
 *
 * Registering a project resolves the path through this rather than storing
 * what was typed: a path that is not a repository cannot be analysed at all,
 * and a *subdirectory* of one is worse than useless — git commands run from
 * there still report the whole repository, so the entry would quietly analyse
 * something other than what it names. Resolved to the repository itself,
 * `/repo`, `/repo/src` and a symlink to either are one project.
 */
export async function toplevel(dir: string): Promise<string | null> {
  try {
    const out = await git(dir, ['rev-parse', '--show-toplevel']);
    return await realpath(out.trim());
  } catch {
    return null;
  }
}
