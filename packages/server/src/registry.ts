import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PluginRegistry, userPluginsDir } from '@strata/core';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** The first-party plugins that ship in this repo. */
const BUILTINS = [
  'plugins/commit-conventional/strata.plugin.json',
  'plugins/git-hotspots/strata.plugin.json',
  'plugins/language-typescript/strata.plugin.json',
];

/**
 * Discover and load plugins: the built-ins that ship here, then every plugin
 * installed in the user plugins directory (see docs/PLUGINS.md). Built-ins go
 * first, so a drop-in plugin can never take over an id Strata ships with.
 *
 * Neither step can fail startup — a plugin that will not load is recorded in
 * `registry.failures()` and served on `GET /plugins`.
 */
export async function buildRegistry(): Promise<PluginRegistry> {
  const registry = new PluginRegistry();
  for (const rel of BUILTINS) {
    await registry.load(resolve(REPO_ROOT, rel), 'builtin');
  }
  await registry.loadDirectory(userPluginsDir(), 'user');
  return registry;
}
