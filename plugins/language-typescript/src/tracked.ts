import type { RepoContext } from '@strata/sdk';

/**
 * Every path git tracks at the analysed revision.
 *
 * The core hands a language plugin only the files matching its extensions, so
 * the `package.json` and `tsconfig.json` that decide what is an entry point and
 * where an alias leads are not in `ctx.files` and have to come from git.
 * Reading the revision rather than the working tree keeps the answer consistent
 * with the rest of the analysis.
 *
 * A repository git cannot be asked about yields nothing rather than throwing:
 * the analysis is still worth running without manifests.
 */
export async function trackedPaths(ctx: RepoContext): Promise<string[]> {
  try {
    // -z: NUL-separated, so paths with spaces or non-ASCII arrive unquoted.
    const listing = await ctx.git(['ls-tree', '-r', '--name-only', '-z', ctx.rev]);
    return listing.split('\0').filter((path) => path !== '');
  } catch (error) {
    ctx.log.warn('could not list files; skipping manifest and alias analysis', error);
    return [];
  }
}

/** One tracked file's contents at the revision, or nothing if it cannot be read. */
export async function readTracked(
  ctx: RepoContext,
  path: string,
): Promise<string | undefined> {
  try {
    return await ctx.git(['show', `${ctx.rev}:${path}`]);
  } catch (error) {
    ctx.log.warn(`could not read ${path}`, error);
    return undefined;
  }
}
