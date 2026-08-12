import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SDK_VERSION, type PluginManifest, type StrataPlugin } from '@strata/sdk';

/** A loaded plugin paired with the manifest it came from. */
export interface LoadedPlugin {
  manifest: PluginManifest;
  plugin: StrataPlugin;
}

/**
 * Holds every plugin the app knows about and lets the orchestrator look them
 * up by kind. Plugins are discovered from `strata.plugin.json` manifests.
 */
export class PluginRegistry {
  private readonly plugins: LoadedPlugin[] = [];

  /** Load a plugin from the directory containing its `strata.plugin.json`. */
  async loadFrom(manifestPath: string): Promise<LoadedPlugin> {
    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8'),
    ) as PluginManifest;

    const wantMajor = SDK_VERSION.split('.')[0];
    const gotMajor = String(manifest.sdk).split('.')[0];
    if (wantMajor !== gotMajor) {
      throw new Error(
        `Plugin "${manifest.id}" targets SDK ${manifest.sdk}, ` +
          `but this build ships SDK ${SDK_VERSION}.`,
      );
    }

    const entry = resolve(dirname(manifestPath), manifest.main);
    const mod = (await import(pathToFileURL(entry).href)) as {
      default: StrataPlugin;
    };
    const loaded: LoadedPlugin = { manifest, plugin: mod.default };
    this.plugins.push(loaded);
    return loaded;
  }

  byKind<K extends StrataPlugin['kind']>(
    kind: K,
  ): Extract<StrataPlugin, { kind: K }>[] {
    return this.plugins
      .map((l) => l.plugin)
      .filter((p): p is Extract<StrataPlugin, { kind: K }> => p.kind === kind);
  }

  all(): readonly LoadedPlugin[] {
    return this.plugins;
  }
}
