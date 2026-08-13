import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Logger, PluginManifest, StrataPlugin } from '@strata/sdk';
import { discoverPlugins } from './discover.js';
import { createConsoleLogger } from './logger.js';
import { readManifest, resolveEntry } from './manifest.js';
import { pluginShapeError } from './plugin-shape.js';

/** Where a plugin came from: shipped with Strata, or dropped in by the user. */
export type PluginSource = 'builtin' | 'user';

/** A loaded plugin paired with the manifest it came from. */
export interface LoadedPlugin {
  manifest: PluginManifest;
  plugin: StrataPlugin;
  source: PluginSource;
  /** Absolute path of the manifest, so the UI can say where it came from. */
  manifestPath: string;
}

/** A plugin that was found but could not be loaded, and why. */
export interface PluginLoadFailure {
  manifestPath: string;
  source: PluginSource;
  error: string;
}

/**
 * Holds every plugin the app knows about and lets the orchestrator look them
 * up by kind. Plugins are discovered from `strata.plugin.json` manifests —
 * the built-ins that ship with Strata and, through `loadDirectory`, whatever a
 * user installed in their plugins directory.
 *
 * A third-party plugin that fails to load must never take the app down with
 * it, so `load`/`loadDirectory` contain the error and record it in `failures()`.
 */
export class PluginRegistry {
  private readonly plugins: LoadedPlugin[] = [];
  private readonly loadFailures: PluginLoadFailure[] = [];

  constructor(
    private readonly log: Logger = createConsoleLogger('strata:plugins'),
  ) {}

  /**
   * Load a plugin from its `strata.plugin.json`. Throws if the manifest is
   * invalid, targets another SDK major, clashes with a loaded id, or does not
   * export what it declares.
   */
  async loadFrom(
    manifestPath: string,
    source: PluginSource = 'builtin',
  ): Promise<LoadedPlugin> {
    const path = resolve(manifestPath);
    const manifest = await readManifest(path);

    // First one wins, and built-ins load first: a drop-in plugin can neither
    // shadow a first-party id nor silently replace another third-party plugin.
    const clash = this.plugins.find((l) => l.manifest.id === manifest.id);
    if (clash) {
      throw new Error(
        `Plugin id "${manifest.id}" is already loaded from ${clash.manifestPath}.`,
      );
    }

    const entry = resolveEntry(path, manifest);
    const mod = (await import(pathToFileURL(entry).href)) as {
      default?: unknown;
    };
    const plugin = mod.default;
    if (!isPlugin(plugin)) {
      throw new Error(
        `Plugin "${manifest.id}" (${entry}) must default-export a plugin object ` +
          `built with one of the SDK's define* helpers.`,
      );
    }
    if (plugin.kind !== manifest.kind) {
      throw new Error(
        `Plugin "${manifest.id}" is declared as kind "${manifest.kind}" ` +
          `but exports kind "${plugin.kind}".`,
      );
    }
    const shapeError = pluginShapeError(manifest.kind, plugin);
    if (shapeError) {
      throw new Error(`Plugin "${manifest.id}" (${entry}) ${shapeError}.`);
    }

    const loaded: LoadedPlugin = {
      manifest,
      plugin,
      source,
      manifestPath: path,
    };
    this.plugins.push(loaded);
    return loaded;
  }

  /**
   * `loadFrom` that never throws: on failure it warns, records the reason and
   * returns `null`, so one broken plugin costs only itself.
   */
  async load(
    manifestPath: string,
    source: PluginSource = 'builtin',
  ): Promise<LoadedPlugin | null> {
    try {
      return await this.loadFrom(manifestPath, source);
    } catch (err) {
      this.fail(resolve(manifestPath), source, err);
      return null;
    }
  }

  /**
   * Load every plugin installed in a plugins directory. A missing directory
   * loads nothing; an unreadable one is recorded as a failure.
   */
  async loadDirectory(
    dir: string,
    source: PluginSource = 'user',
  ): Promise<LoadedPlugin[]> {
    let manifests: string[];
    try {
      manifests = await discoverPlugins(dir);
    } catch (err) {
      this.fail(resolve(dir), source, err);
      return [];
    }

    const loaded: LoadedPlugin[] = [];
    for (const manifestPath of manifests) {
      const plugin = await this.load(manifestPath, source);
      if (plugin) loaded.push(plugin);
    }
    return loaded;
  }

  byKind<K extends StrataPlugin['kind']>(
    kind: K,
  ): Extract<StrataPlugin, { kind: K }>[] {
    return this.loadedByKind(kind).map((l) => l.plugin);
  }

  /**
   * Like `byKind`, but keeps each plugin's manifest attached — the orchestrator
   * needs the id and version to key cache entries.
   */
  loadedByKind<K extends StrataPlugin['kind']>(
    kind: K,
  ): (LoadedPlugin & { plugin: Extract<StrataPlugin, { kind: K }> })[] {
    return this.plugins.filter(
      (l): l is LoadedPlugin & { plugin: Extract<StrataPlugin, { kind: K }> } =>
        l.plugin.kind === kind,
    );
  }

  all(): readonly LoadedPlugin[] {
    return this.plugins;
  }

  /** Plugins that were found but skipped — surfaced in the settings UI. */
  failures(): readonly PluginLoadFailure[] {
    return this.loadFailures;
  }

  private fail(
    manifestPath: string,
    source: PluginSource,
    err: unknown,
  ): void {
    const error = err instanceof Error ? err.message : String(err);
    this.log.warn(`skipped ${manifestPath}: ${error}`);
    this.loadFailures.push({ manifestPath, source, error });
  }
}

function isPlugin(value: unknown): value is StrataPlugin {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { kind?: unknown }).kind === 'string'
  );
}
