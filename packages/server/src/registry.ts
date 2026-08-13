import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PluginRegistry } from '@strata/core';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** The first-party plugins that ship in this repo. */
const BUILTINS = [
  'plugins/commit-conventional/strata.plugin.json',
  'plugins/git-hotspots/strata.plugin.json',
  'plugins/language-typescript/strata.plugin.json',
];

/**
 * Discover and load the built-in plugins. In a real deployment this also scans
 * a user plugins directory (see docs/PLUGINS.md).
 */
export async function buildRegistry(): Promise<PluginRegistry> {
  const registry = new PluginRegistry();
  for (const rel of BUILTINS) {
    try {
      await registry.loadFrom(resolve(REPO_ROOT, rel));
    } catch (err) {
      console.warn(`skip plugin ${rel}:`, (err as Error).message);
    }
  }
  return registry;
}
