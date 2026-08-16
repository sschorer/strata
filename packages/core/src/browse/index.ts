/**
 * Browsing the server's filesystem for a repository to register — the folder
 * picker behind *Add project*. Directory names only, confined to the roots in
 * `../roots`; see there for what that means and why.
 */
export * from './types.js';
export { listDirectory } from './list.js';
