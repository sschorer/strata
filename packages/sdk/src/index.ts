/**
 * @strata/sdk — the contracts every Strata plugin implements.
 *
 * There are four plugin kinds, each a small, versioned interface:
 *   - LanguagePlugin          per-language static analysis (deps, dead code, metrics)
 *   - CommitConventionPlugin  parse a commit message into structured meaning
 *   - GitMetricPlugin         derive a metric series from repository history
 *   - AIProvider              a chat/embeddings backend (OpenAI, Anthropic, Ollama, …)
 *
 * A plugin is a package with a `strata.plugin.json` manifest whose `main`
 * default-exports one of the `define*` helpers below. The core loads manifests,
 * imports the entry, and registers the returned object.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** SemVer of the SDK contract a plugin was built against. */
export const SDK_VERSION = '0.1.0' as const;

export type PluginKind =
  | 'language'
  | 'commit-convention'
  | 'git-metric'
  | 'ai-provider';

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

/** A file as seen by an analysis run, addressed by repo-relative path. */
export interface RepoFile {
  path: string;
  /** Git blob sha — used to key the incremental cache. */
  blob: string;
  /** Lazily read the file's UTF-8 contents. */
  read(): Promise<string>;
}

/**
 * Per-file memoisation, keyed on `(pluginId, blob)` — the incremental cache.
 *
 * The core scopes an instance to the plugin it hands the `RepoContext` to, so
 * a plugin never sees another plugin's entries and never passes its own id.
 * Wrap the expensive per-file part of an analysis in `file()`: on a rerun,
 * every file whose blob is unchanged returns from the cache and `compute`
 * never runs.
 */
export interface PluginCache {
  /**
   * Return the cached value for `file`, or run `compute` and store its result.
   *
   * `compute` must be pure in the file's contents — anything else (other files,
   * history, the clock) makes the entry wrong on the next hit. The value is
   * persisted as JSON, so it must be JSON-serialisable; `undefined` round-trips
   * as `null`.
   */
  file<T>(file: RepoFile, compute: (file: RepoFile) => Promise<T>): Promise<T>;
}

/** Immutable view of the repository handed to plugins. */
export interface RepoContext {
  /** Absolute path to the working tree root. */
  root: string;
  /** The revision being analysed (commit sha). */
  rev: string;
  /** All files tracked at `rev`, already filtered by ignore rules. */
  files: RepoFile[];
  /** Run a read-only git command and get stdout. */
  git(args: string[]): Promise<string>;
  /** Structured logger scoped to the current plugin. */
  log: Logger;
  /**
   * Blob-keyed cache scoped to this plugin. Always present — when caching is
   * switched off the core injects a pass-through that just calls `compute`.
   */
  cache: PluginCache;
}

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

/** A node in a dependency graph (a file, module, or symbol). */
export interface GraphNode {
  id: string;
  label: string;
  kind: 'file' | 'module' | 'package' | 'symbol';
  /** Free-form, plugin-specific attributes (loc, complexity, layer, …). */
  meta?: Record<string, number | string | boolean>;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: 'import' | 'inject' | 'call' | 'reference';
  /** Optional weight, e.g. number of references. */
  weight?: number;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Strongly-connected components with >1 node = import cycles. */
  cycles: string[][];
}

export interface DeadCodeFinding {
  path: string;
  symbol?: string;
  line?: number;
  reason: 'unreferenced-export' | 'unreachable-file' | 'unused-dependency';
}

export interface CodeMetric {
  path: string;
  loc: number;
  /** Cyclomatic complexity if the plugin computes it. */
  complexity?: number;
  /** 0–1 fraction of lines duplicated elsewhere, if computed. */
  duplication?: number;
}

// ---------------------------------------------------------------------------
// 1. Language plugins
// ---------------------------------------------------------------------------

export interface LanguageAnalysis {
  graph: DependencyGraph;
  deadCode: DeadCodeFinding[];
  metrics: CodeMetric[];
}

export interface LanguagePlugin {
  kind: 'language';
  /** File extensions this plugin claims, without the dot: ["ts", "tsx"]. */
  extensions: string[];
  /**
   * Analyse the subset of `ctx.files` matching `extensions`.
   * Implementations should be incremental-friendly: pure in (files) → out.
   */
  analyze(ctx: RepoContext): Promise<LanguageAnalysis>;
}

export function defineLanguagePlugin(
  p: Omit<LanguagePlugin, 'kind'>,
): LanguagePlugin {
  return { kind: 'language', ...p };
}

// ---------------------------------------------------------------------------
// 2. Commit-convention plugins
// ---------------------------------------------------------------------------

export interface ParsedCommit {
  /** The change type: "feat", "fix", … or null when it doesn't match. */
  type: string | null;
  scope: string | null;
  /** True when the commit signals a breaking change. */
  breaking: boolean;
  subject: string;
  /** Arbitrary extracted tags: issue refs, gitmoji, co-authors, … */
  tags: Record<string, string[]>;
  /** True when the message satisfied this convention at all. */
  valid: boolean;
}

export interface RawCommit {
  sha: string;
  author: string;
  authorEmail: string;
  date: string;
  /** Full commit message (subject + body). */
  message: string;
}

export interface CommitConventionPlugin {
  kind: 'commit-convention';
  /** e.g. "conventional", "gitmoji", "custom-jira". */
  convention: string;
  parse(commit: RawCommit): ParsedCommit;
}

export function defineCommitConventionPlugin(
  p: Omit<CommitConventionPlugin, 'kind'>,
): CommitConventionPlugin {
  return { kind: 'commit-convention', ...p };
}

// ---------------------------------------------------------------------------
// 3. Git-metric plugins
// ---------------------------------------------------------------------------

/** One measured point, e.g. a file's hotspot score. */
export interface MetricPoint {
  /** Subject of the measurement: a file path, an author, a module. */
  subject: string;
  value: number;
  meta?: Record<string, number | string>;
}

export interface MetricSeries {
  /** e.g. "hotspots", "change-coupling", "code-age", "bus-factor". */
  id: string;
  label: string;
  unit?: string;
  points: MetricPoint[];
}

export interface GitMetricPlugin {
  kind: 'git-metric';
  id: string;
  /** Compute the series over the given history window. */
  compute(ctx: RepoContext, history: RawCommit[]): Promise<MetricSeries>;
}

export function defineGitMetricPlugin(
  p: Omit<GitMetricPlugin, 'kind'>,
): GitMetricPlugin {
  return { kind: 'git-metric', ...p };
}

// ---------------------------------------------------------------------------
// 4. AI providers
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  kind: 'ai-provider';
  /** e.g. "openai", "anthropic", "ollama". */
  id: string;
  /** Models this provider exposes; used to populate the settings UI. */
  listModels(): Promise<string[]>;
  /** Single-shot or streamed chat completion. */
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  /** Optional embeddings for repo-wide semantic search / RAG. */
  embed?(texts: string[]): Promise<number[][]>;
}

export function defineAIProvider(p: Omit<AIProvider, 'kind'>): AIProvider {
  return { kind: 'ai-provider', ...p };
}

// ---------------------------------------------------------------------------

export type StrataPlugin =
  | LanguagePlugin
  | CommitConventionPlugin
  | GitMetricPlugin
  | AIProvider;
