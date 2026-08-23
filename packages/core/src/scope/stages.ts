import type { OutputType } from '@strata/sdk';
import type { LoadedPlugin } from '../registry.js';

/**
 * Output types a setting still names plugins for, one list per type. A stage
 * producing one of these is switched on and off through the setting that has
 * always switched its kind on and off.
 */
const ALLOW_LISTED: readonly OutputType[] = ['graph', 'metrics'];

/**
 * The stages a run may call.
 *
 * A stage producing something a kind-shaped setting still selects — a graph
 * (`languages`), a metric series (`metrics`) — takes part only when that
 * setting selected it, so a project switching a plugin off keeps switching it
 * off across its migration. A stage producing anything else has no setting to
 * be left out of, and runs: **unnamed means enabled**, which is the rule the
 * repository's config file makes general
 * ([ADR-12](../../../../docs/adr/0012-repo-owned-config-file.md)) and the
 * reason installing a stage visibly does something.
 *
 * The parsed commit log is deliberately not allow-listed here. One convention
 * runs and the rest stand by, which is an exclusive group rather than a list —
 * `exclusiveStages()` settles that, from the group the conventions themselves
 * declare.
 */
export function enabledStages(
  loaded: readonly LoadedPlugin[],
  selected: readonly LoadedPlugin[],
): LoadedPlugin[] {
  const ids = new Set(selected.map((entry) => entry.manifest.id));
  return loaded.filter((entry) => {
    if (entry.plugin.kind !== 'stage') return false;
    const produces = entry.manifest.produces;
    // A manifest without one never loads; if one ever did, it is not something
    // a list names either.
    if (produces === undefined || !ALLOW_LISTED.includes(produces)) return true;
    return ids.has(entry.manifest.id);
  });
}
