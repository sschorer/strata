import type { PluginRegistry, ProjectStore, Strata } from '@strata/core';

/** What every route needs from the app it is registered on. */
export interface RouteContext {
  strata: Strata;
  registry: PluginRegistry;
  projects: ProjectStore;
}
