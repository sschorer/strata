import type { Logger } from '@strata/sdk';
import type { ProjectConfig, ProjectConfigPatch } from '../config/index.js';
import type { RunReport } from '../types.js';

/**
 * What the switcher shows about a project's last run: the run's own metadata
 * plus the revision it ran on — the same pair `AnalysisReport` carries.
 */
export interface ProjectAnalysis extends RunReport {
  rev: string;
}

/** One registered project. */
export interface Project {
  /** Stable slug, derived from the display name when the project is added. */
  id: string;
  /** What the switcher labels it. */
  name: string;
  /** Absolute working-tree root of the repository. */
  root: string;
  /** When it was registered, ISO 8601. */
  addedAt: string;
  /** Summary of the last analysis of this root; null until one runs. */
  lastAnalysis: ProjectAnalysis | null;
}

/** What a caller supplies to register a project; the store derives the rest. */
export interface ProjectInput {
  name: string;
  root: string;
}

/**
 * What can be changed about a registered project *after* it is registered —
 * its identity, not its settings. The id is not in here: it is what links to
 * this project point at, and a rename must not break them.
 */
export interface ProjectUpdate {
  name?: string;
  root?: string;
}

export interface ProjectStoreOptions {
  /** Database file. Overrides `dir`. */
  path?: string;
  /**
   * Directory to hold `projects.db`. Defaults to `$STRATA_DATA_DIR`, else
   * `<cwd>/.strata`.
   */
  dir?: string;
  /** Where to report a store that could not be opened. */
  log?: Logger;
}

/**
 * The project registry: which repositories this workbench knows about. Durable
 * user data, unlike the analysis cache — nothing here is derived, so nothing
 * here is ever dropped to reclaim space, and `DELETE /cache` does not touch it.
 *
 * Every method is synchronous: the registry is a handful of rows read on
 * request, and SQLite through `node:sqlite` is synchronous anyway.
 */
export interface ProjectStore {
  /** The database file backing the store, or `null` when it is in memory. */
  readonly path: string | null;
  /** Every project, oldest registration first. */
  list(): Project[];
  get(id: string): Project | undefined;
  /** The project registered for a working-tree root, if any. */
  findByRoot(root: string): Project | undefined;
  /**
   * Register a project. Throws `DuplicateRootError` if the root is already
   * registered, and `Error` if name or root is blank.
   */
  add(input: ProjectInput): Project;
  /**
   * Rename a project or point it at another root; `undefined` if the id is
   * unknown. Throws `DuplicateRootError` if another project holds the new root.
   */
  update(id: string, changes: ProjectUpdate): Project | undefined;
  /** Store the summary of a finished run; `undefined` if the id is unknown. */
  recordAnalysis(id: string, analysis: ProjectAnalysis): Project | undefined;
  /**
   * This project's settings, filled out with the defaults; `undefined` if the
   * id is unknown.
   */
  config(id: string): ProjectConfig | undefined;
  /**
   * Merge a patch into this project's settings and return the result;
   * `undefined` if the id is unknown. Throws `InvalidConfigError` on a value
   * that cannot be stored as written.
   */
  setConfig(id: string, patch: ProjectConfigPatch): ProjectConfig | undefined;
  /**
   * Drop the entry and its settings. Never touches the repository on disk.
   */
  remove(id: string): boolean;
  close(): void;
}
