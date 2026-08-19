import type {
  AnalysisQueue,
  PluginRegistry,
  ProjectStore,
  SettingsStore,
} from '@strata/core';

/** What every route needs from the app it is registered on. */
export interface RouteContext {
  /**
   * The way in to the pipeline. No handler runs an analysis itself: it asks the
   * queue, which runs it on a thread of its own and lets this one carry on
   * answering.
   */
  analyses: AnalysisQueue;
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
