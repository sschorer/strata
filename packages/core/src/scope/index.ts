/**
 * What one run is allowed to look at and who is allowed to look — a project's
 * config turned into the two decisions the pipeline makes before it starts:
 * which files are in scope, and which plugins take part.
 */
export { globMatcher } from './glob.js';
export { scopedFiles, type FileScope } from './files.js';
export { claimedFiles } from './extensions.js';
export { enabledPlugins } from './plugins.js';
export { chosenConvention, type LoadedConvention } from './convention.js';
export { requireLoaded } from './named.js';
export { MissingPluginError, type NamedBy } from './errors.js';
