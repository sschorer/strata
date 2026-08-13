import type { RepoFile } from './repo.js';

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
