import type { PluginKind } from '@strata/sdk';

/**
 * Where a plugin id came from: the configuration setting that carried it, and
 * the kind that setting selects from.
 *
 * Both belong in the failure. "Plugin X is missing" leaves the reader to go and
 * find which setting asked for it, and having installed the wrong *kind* of X
 * is the other half of the same mistake.
 */
export interface NamedBy {
  /** The setting, spelled as configuration spells it: `languages`, `convention`. */
  setting: string;
  /** The kind it selects from — what the reader has to go and install. */
  kind: PluginKind;
}

/**
 * A run whose configuration names a plugin this workbench has not loaded.
 *
 * It fails the run rather than dropping the name, because the two outcomes are
 * indistinguishable once they reach a report: a history nobody parsed and a
 * history that conforms to nothing are both zero valid commits, and a gate
 * reading that number would pass a build that checked nothing. The same holds
 * for a language module or a metric — an analysis missing the plugin that would
 * have found the problem looks exactly like an analysis that found no problem
 * ([ADR-12](../../../../docs/adr/0012-repo-owned-config-file.md)).
 */
export class MissingPluginError extends Error {
  constructor(
    readonly named: NamedBy,
    /** The ids that name nothing loaded, in the order the setting listed them. */
    readonly missing: readonly string[],
    /** Every id of that kind this workbench did load, for the reader to pick from. */
    readonly loaded: readonly string[],
  ) {
    super(describe(named, missing, loaded));
    this.name = 'MissingPluginError';
  }
}

function describe(
  named: NamedBy,
  missing: readonly string[],
  loaded: readonly string[],
): string {
  const noun = missing.length === 1 ? 'plugin' : 'plugins';
  return (
    `Setting "${named.setting}" names ${named.kind} ${noun} ` +
    `${quoted(missing)}, which this workbench has not loaded. ` +
    (loaded.length > 0
      ? `Loaded ${named.kind} plugins: ${quoted(loaded)}.`
      : `No ${named.kind} plugin is loaded.`)
  );
}

function quoted(ids: readonly string[]): string {
  return ids.map((id) => `"${id}"`).join(', ');
}
