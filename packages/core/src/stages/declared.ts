import type { StagePlugin } from '@strata/sdk';
import type { LoadedPlugin } from '../registry.js';
import type { Stage } from './types.js';

/**
 * The stages among a set of loaded plugins — the ones whose manifest declared
 * one and whose module exports `run()`.
 *
 * Everything the scheduler needs comes off the manifest, which is the point of
 * putting it there: the plan is built from JSON the registry read, not from
 * anything the module said about itself (`docs/adr/0010`). A plugin of any
 * other kind is not here; it is still run by the pipeline that owns its kind.
 */
export function declaredStages(loaded: readonly LoadedPlugin[]): Stage[] {
  const stages: Stage[] = [];
  for (const entry of loaded) {
    const { manifest, plugin } = entry;
    // The registry refuses a `stage` manifest without a `produces`, so this
    // narrowing never drops a plugin that should have been scheduled.
    if (plugin.kind !== 'stage' || !manifest.produces) continue;
    stages.push({
      id: manifest.id,
      version: manifest.version,
      consumes: manifest.consumes ?? [],
      produces: manifest.produces,
      ...(manifest.filter ? { filter: manifest.filter } : {}),
      ...(manifest.exclusive ? { exclusive: manifest.exclusive } : {}),
      run: (plugin as StagePlugin).run.bind(plugin),
    });
  }
  return stages;
}
