/**
 * Every plugin kind, as a value — a loader validating a hand-written manifest
 * needs the list at runtime, not just the type.
 */
export const PLUGIN_KINDS = [
  'language',
  'commit-convention',
  'git-metric',
  'ai-provider',
] as const;

export type PluginKind = (typeof PLUGIN_KINDS)[number];

/** Parsed from `strata.plugin.json`, sitting next to a plugin's package.json. */
export interface PluginManifest {
  /** Unique id, e.g. "strata-language-typescript". */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  kind: PluginKind;
  version: string;
  /** SDK major this plugin targets; core refuses to load a mismatch. */
  sdk: string;
  /** Module path (relative to the package) whose default export is the plugin. */
  main: string;
  description?: string;
  author?: string;
}
