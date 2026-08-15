import type {
  PluginRegistry,
  ProjectStore,
  SettingsStore,
  Strata,
} from '@strata/core';

/** What every route needs from the app it is registered on. */
export interface RouteContext {
  strata: Strata;
  registry: PluginRegistry;
  projects: ProjectStore;
  settings: SettingsStore;
  /**
   * Directory the drop-in plugins were actually read from at startup — the
   * app settings' `engine.pluginsDir`, or the environment's default. Resolved
   * once, so `/plugins` reports what was scanned rather than what a setting
   * changed to since.
   */
  pluginsDir: string;
}
