import type { LoadedPluginInfo } from '$lib/api';
import type { RunPluginConfig } from './run-plugins';

/** One setting that names a plugin this workbench has not loaded. */
export interface MissingPlugins {
  /** The setting, spelled as the API and the config file spell it. */
  setting: keyof RunPluginConfig;
  /** The kind it selects from — what has to be installed to satisfy it. */
  kind: LoadedPluginInfo['kind'];
  /** The ids that name nothing loaded, in the order the setting lists them. */
  ids: string[];
}

/**
 * What this project's settings name that nobody loaded — the reason a run over
 * it will not start.
 *
 * The core refuses such a run outright rather than dropping the name, because a
 * report missing the plugin that would have found the problem is
 * indistinguishable from one that found no problem. That makes it something the
 * screen has to say *before* the button is pressed: the list of who takes part
 * is otherwise a confident answer to a run that is not going to happen.
 *
 * Naming nothing names nothing missing — `null` is every registered plugin of
 * that kind, which is what an unconfigured project asks for.
 */
export function missingPlugins(
  plugins: readonly LoadedPluginInfo[],
  config?: RunPluginConfig | null,
): MissingPlugins[] {
  if (!config) return [];
  return [
    named('languages', 'language', plugins, config.languages),
    named('metrics', 'git-metric', plugins, config.metrics),
    named('convention', 'commit-convention', plugins, config.convention),
  ].filter((entry): entry is MissingPlugins => entry !== null);
}

function named(
  setting: keyof RunPluginConfig,
  kind: LoadedPluginInfo['kind'],
  plugins: readonly LoadedPluginInfo[],
  names: readonly string[] | string | null,
): MissingPlugins | null {
  if (names === null) return null;
  const loaded = plugins.filter((p) => p.kind === kind).map((p) => p.id);
  const ids = (typeof names === 'string' ? [names] : names).filter(
    (id) => !loaded.includes(id),
  );
  return ids.length > 0 ? { setting, kind, ids } : null;
}
