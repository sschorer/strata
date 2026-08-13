import type { PluginCache } from './cache.js';
import type { Logger } from './logger.js';

/** A file as seen by an analysis run, addressed by repo-relative path. */
export interface RepoFile {
  path: string;
  /** Git blob sha — used to key the incremental cache. */
  blob: string;
  /** Lazily read the file's UTF-8 contents. */
  read(): Promise<string>;
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
