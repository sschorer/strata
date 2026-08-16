import { sep } from 'node:path';

/**
 * Whether a *resolved* path is a root or sits inside one. Compared with a
 * separator on the end, so `/repos-private` is not inside `/repos`.
 */
export function withinRoots(path: string, roots: readonly string[]): boolean {
  return roots.some(
    (root) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep),
  );
}
