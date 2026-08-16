/**
 * The roots Strata may reach on disk — the allow-list every path that arrives
 * in a request is confined to, whether it is browsed, registered or analysed.
 * See `config.ts` for what configures it and why.
 */
export * from './errors.js';
export { configuredRoots, resolveRoots } from './config.js';
export { withinRoots } from './within.js';
export { allowedDirectory } from './allowed.js';
