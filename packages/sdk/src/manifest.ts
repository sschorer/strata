import type { OutputType } from './output.js';

/**
 * Every plugin kind, as a value — a loader validating a hand-written manifest
 * needs the list at runtime, not just the type.
 */
export const PLUGIN_KINDS = [
  'language',
  'commit-convention',
  'git-metric',
] as const;

export type PluginKind = (typeof PLUGIN_KINDS)[number];

/**
 * The files a stage wants, by extension and/or by glob.
 *
 * Declared rather than applied by the stage itself, because the *core* applies
 * it: a stage only ever sees the files it matched, and so does its cache key —
 * "the files this stage actually read" rather than every file in the
 * repository, so a README edit does not invalidate a TypeScript graph
 * (`docs/adr/0010`).
 */
export interface StageFilter {
  /** Extensions, written without the dot: `["ts", "tsx"]`. */
  extensions?: string[];
  /** Repo-relative globs: `["proto/**\/*.proto"]`. */
  globs?: string[];
}

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

  /*
   * What this plugin's stage is, as static data.
   *
   * All four live here rather than on the exported object so the core can read
   * them without importing the plugin: planning a run — ordering the stages and
   * rejecting a configuration that cannot be satisfied — must never require
   * running third-party code (`docs/adr/0010`).
   *
   * Optional for as long as `kind` still drives a run: a plugin that declares
   * none of them is an ordinary language, git-metric or commit-convention
   * plugin and runs the way it always did. The stage contract lands beside the
   * kinds and replaces them once nothing needs them (`docs/adr/0011`).
   */

  /**
   * Output types the stage reads. Every upstream output of each type arrives,
   * keyed by the plugin that produced it, so a stage never needs to know which
   * plugins are installed.
   */
  consumes?: OutputType[];
  /** The single output type the stage produces. */
  produces?: OutputType;
  /** The files it wants; omitted means it reads no files of its own. */
  filter?: StageFilter;
  /**
   * A named set of stages of which at most one may run — a repository has one
   * commit convention, not several. Configuration names the active member.
   */
  exclusive?: string;
}
