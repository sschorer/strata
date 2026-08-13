// Load the built core and the first-party plugins.
// Imports from `dist`, so `make build` must have run.
import { resolve } from 'node:path';

/** The first-party plugin manifests, same list the server loads. */
export const BUILTIN_PLUGINS = [
  'plugins/commit-conventional/strata.plugin.json',
  'plugins/git-hotspots/strata.plugin.json',
  'plugins/language-typescript/strata.plugin.json',
];

/** Import `@strata/core` from its build output, with a helpful error if absent. */
export async function loadCore(repoRoot) {
  try {
    return await import(resolve(repoRoot, 'packages/core/dist/index.js'));
  } catch {
    console.error('Build first: `make build` (or `pnpm -r build`).');
    process.exit(1);
  }
}

/**
 * A registry with every built-in plugin loaded, plus whatever is installed in
 * the user plugins directory — the CLI sees the same plugins as the server.
 */
export async function builtinRegistry(repoRoot, { PluginRegistry, userPluginsDir }) {
  const registry = new PluginRegistry();
  for (const rel of BUILTIN_PLUGINS) {
    await registry.load(resolve(repoRoot, rel), 'builtin');
  }
  await registry.loadDirectory(userPluginsDir(), 'user');
  return registry;
}
