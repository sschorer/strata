/** One step of the picker's path bar. */
export interface PathCrumb {
  label: string;
  path: string;
}

/**
 * A path as the steps you can click back to, starting at the browse root it
 * sits in — never above one, because above one is not browsable.
 *
 * Server paths, so POSIX separators: the machine running Strata is a Linux
 * container or a workstation, and the browser only ever echoes what it was
 * given back to the same server.
 */
export function pathCrumbs(
  path: string,
  roots: readonly string[] = [],
): PathCrumb[] {
  if (!path) return [];

  // The deepest root containing the path — with nested roots, the one that
  // shows the fewest steps is the one the reader is actually inside.
  const root = roots
    .filter((entry) => path === entry || path.startsWith(withSlash(entry)))
    .sort((a, b) => b.length - a.length)[0];
  if (!root) return [{ label: path, path }];

  const crumbs: PathCrumb[] = [{ label: labelFor(root), path: root }];
  const rest = path.slice(root.length).split('/').filter(Boolean);
  let walked = root === '/' ? '' : root;
  for (const segment of rest) {
    walked = `${walked}/${segment}`;
    crumbs.push({ label: segment, path: walked });
  }
  return crumbs;
}

function withSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

function labelFor(root: string): string {
  // `/` has no last segment, and is its own name.
  return root.split('/').filter(Boolean).at(-1) ?? root;
}
