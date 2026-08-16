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

/** One `type` or `scope` of the analysed window; `null` where a commit named none. */
export interface CommitBucket {
  name: string | null;
  count: number;
  /** 0–1 of every parsed commit in the window. */
  share: number;
  breaking: number;
}

/** One week of the activity series, dated by its Monday (UTC), `YYYY-MM-DD`. */
export interface CommitWeek {
  week: string;
  commits: number;
}

/**
 * The history window as the core folded it: what the *Commit analytics* screen
 * prints, counted once on the server so a screen never has to walk the log and
 * arrive at its own quietly different answer.
 */
export interface CommitAnalytics {
  total: number;
  valid: number;
  /** Parsed commits the convention could not make sense of. */
  invalid: number;
  /** 0–1 of the judged commits; 0 when nothing judged them. */
  validRate: number;
  breaking: number;
  types: CommitBucket[];
  scopes: CommitBucket[];
  /** Contiguous weeks, oldest first — a week with no commits included as 0. */
  weeks: CommitWeek[];
}

export interface AnalysisReport {
  rev: string;
  run: RunReport;
  languages: Record<string, LanguageAnalysis>;
  metrics: MetricSeries[];
  commits: ParsedCommit[];
  commitAnalytics: CommitAnalytics;
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

/**
 * What *Project settings → General* sends. Both fields are optional and a
 * field left out keeps its value; the server refuses a patch that names
 * neither.
 */
export interface UpdateProjectRequest {
  name?: string;
  root?: string;
}

export interface RemoveProjectResponse {
  removed: boolean;
}

/** One architecture fitness rule: `from` may not import `to`. */
export interface ArchitectureRule {
  /** Path glob the rule constrains, e.g. `src/ui/**`. */
  from: string;
  /** Path glob it may not reach, e.g. `src/db/**`. */
  to: string;
  /** Enforced rules are meant to fail a CI gate; the rest only report. */
  enforced: boolean;
}

/**
 * What an analysis of one project *does* — everything the *Project settings*
 * sections configure except identity, which belongs to the registry entry.
 * The server stores it sparsely and answers with the defaults filled in, so
 * every field here always has a value.
 */
export interface ProjectConfig {
  /** Revision to analyse; `HEAD` follows whatever is checked out. */
  rev: string;
  /** Cap on the history window, in commits; `null` for the whole history. */
  historyLimit: number | null;
  /** Globs excluded from the analysis. */
  ignore: string[];
  /** Repo-relative paths to analyse; empty means the whole repository. */
  paths: string[];
  /** Ids of the language plugins that may run, or `null` for every one. */
  languages: string[] | null;
  /** Ids of the git-metric plugins that may run, or `null` for all of them. */
  metrics: string[] | null;
  /** Id of the commit-convention plugin to parse with, or `null` for the first. */
  convention: string | null;
  rules: ArchitectureRule[];
}

/**
 * A partial update. A field left out keeps its value and one that is sent
 * replaces it whole — an array field is the new list, not an addition to the
 * old one — so a screen can send back exactly what it shows.
 */
export type ProjectConfigPatch = Partial<ProjectConfig>;

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
