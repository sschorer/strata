/**
 * Browsing the server's filesystem for a repository to register — the folder
 * picker behind *Add project*. Directory names only, confined to the browse
 * roots; see `roots.ts` for what that means and why.
 */
export * from './types.js';
export * from './errors.js';
export { listDirectory } from './list.js';
export { configuredRoots, resolveRoots, withinRoots } from './roots.js';
