import type { OutputType, PluginKind } from '@strata/sdk';

/**
 * What each pre-stage kind produced, said as an output type.
 *
 * Configuration still names plugins per kind — `languages`, `metrics`,
 * `convention` — and a plugin that has migrated to a stage no longer answers to
 * its old kind. Without this table a project that switched hotspots on by id
 * would be naming a plugin the workbench "has not loaded" the moment hotspots
 * became a stage, so the two are held together by what the plugin produces
 * rather than by what it calls itself.
 *
 * Transitional by construction: it disappears with the kinds, when a
 * repository's config names stages directly (`docs/adr/0012`).
 */
const PRODUCED_BY: Partial<Record<PluginKind, OutputType>> = {
  language: 'graph',
  'git-metric': 'metrics',
  'commit-convention': 'commits',
};

/** The output type a `kind` plugin produced, or `null` for `stage` itself. */
export function producedByKind(kind: PluginKind): OutputType | null {
  return PRODUCED_BY[kind] ?? null;
}
