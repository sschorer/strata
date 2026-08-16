import type {
  LanguageAnalysis,
  MetricSeries,
  ParsedCommit,
  PluginManifest,
} from '@strata/sdk';

/**
 * The shapes `@strata/server` puts on the wire. The leaf types come from
 * `@strata/sdk` — the published contract both sides already share — while the
 * envelopes below are the HTTP responses themselves, which live nowhere else.
 *
 * These are type-only imports: nothing from the SDK is bundled into the app,
 * and the UI still talks to the server over REST only.
 */

export type PluginSource = 'builtin' | 'user';

export interface HealthResponse {
  status: string;
}

export interface LoadedPluginInfo extends PluginManifest {
  source: PluginSource;
}

export interface PluginFailureInfo {
  manifestPath: string;
  source: PluginSource;
  error: string;
}

export interface PluginsResponse {
  /** Directory third-party plugins are read from (may not exist yet). */
  directory: string;
  plugins: LoadedPluginInfo[];
  failures: PluginFailureInfo[];
}

export interface CacheReport {
  enabled: boolean;
  path?: string;
  hits: number;
  misses: number;
  runHits: number;
  runMisses: number;
  writes: number;
}

/** What one run did — what the header line and the overview stat cards read. */
export interface RunReport {
  /** Branch the analysed revision names; null for a detached HEAD, sha or tag. */
  branch: string | null;
  files: number;
  durationMs: number;
  /** When the run finished, ISO 8601. */
  finishedAt: string;
}

export interface AnalysisReport {
  rev: string;
  run: RunReport;
  languages: Record<string, LanguageAnalysis>;
  metrics: MetricSeries[];
  commits: ParsedCommit[];
  cache: CacheReport;
}

/** The last run over a registered project, as the registry keeps it. */
export interface ProjectAnalysis extends RunReport {
  rev: string;
}

/** One repository this workbench knows about — a row of the switcher. */
export interface Project {
  id: string;
  name: string;
  /** Absolute working-tree root, as the server resolved it. */
  root: string;
  /** When it was registered, ISO 8601. */
  addedAt: string;
  /** Summary of the last analysis of this root; null until one has run. */
  lastAnalysis: ProjectAnalysis | null;
}

export interface ProjectsResponse {
  projects: Project[];
}

/**
 * What *Add project* sends. The root is a path on the server's machine: it
 * resolves it to the repository containing it, so a subdirectory registers
 * the repo rather than a second entry for it.
 */
export interface AddProjectRequest {
  name: string;
  root: string;
}

export interface RemoveProjectResponse {
  removed: boolean;
}

/** One subdirectory, as the folder picker lists it. */
export interface DirectoryEntry {
  name: string;
  /** Absolute path on the server's machine. */
  path: string;
  /** Whether it is a git working tree — the folders worth registering. */
  repo: boolean;
}

/**
 * A directory on the machine running the server. Directory names only: the
 * endpoint never lists files or reads anything, and only reaches inside the
 * browse roots it reports here.
 */
export interface DirectoryListing {
  path: string;
  /** One level up, or `null` at a browse root. */
  parent: string | null;
  repo: boolean;
  entries: DirectoryEntry[];
  /** Everywhere browsing may start; empty when the server browses nothing. */
  roots: string[];
}

export interface AnalyzeRequest {
  /** Absolute path of the repo working tree to analyse. */
  root: string;
  rev?: string;
  historyLimit?: number;
  /** Set false to recompute everything, ignoring the incremental cache. */
  cache?: boolean;
}

export interface ClearCacheResponse {
  cleared: boolean;
}
