import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { Logger, PluginCache, RepoFile } from '@strata/sdk';

/**
 * The incremental cache (ADR-4).
 *
 * Two levels, both in one SQLite file:
 *
 *   - **file** — `(pluginId, blob) → JSON`. The unit the whole design is built
 *     around: a git blob sha *is* the content hash, so an entry stays valid for
 *     as long as the file does, across revisions, branches and repositories.
 *     Plugins reach this through `RepoContext.cache`.
 *   - **run** — `(pluginId, runKey) → JSON`. A whole plugin result, keyed on a
 *     digest of everything that went into it. When nothing changed at all, the
 *     plugin is skipped entirely rather than re-assembling a graph from cached
 *     per-file parts.
 *
 * The plugin's version is part of both keys, so publishing a new plugin build
 * invalidates exactly that plugin's entries; stale rows age out via `prune()`.
 *
 * SQLite is via `node:sqlite`, so the cache adds no dependency to the runtime.
 */

/** Bump when the table layout changes; a mismatch wipes and rebuilds the file. */
const SCHEMA_VERSION = '1';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS file_cache (
  plugin_id TEXT    NOT NULL,
  version   TEXT    NOT NULL,
  blob      TEXT    NOT NULL,
  value     TEXT    NOT NULL,
  used_at   INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, version, blob)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS file_cache_used_at ON file_cache (used_at);

CREATE TABLE IF NOT EXISTS run_cache (
  plugin_id TEXT    NOT NULL,
  version   TEXT    NOT NULL,
  run_key   TEXT    NOT NULL,
  value     TEXT    NOT NULL,
  used_at   INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, version, run_key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS run_cache_used_at ON run_cache (used_at);
`;

export interface CacheStats {
  /** Per-file lookups that were served from the cache. */
  hits: number;
  /** Per-file lookups that had to be computed. */
  misses: number;
  /** Whole plugin runs served from the cache (plugin never ran). */
  runHits: number;
  runMisses: number;
  /** Entries written back on this run. */
  writes: number;
}

export interface CacheOptions {
  /**
   * Off switch. Defaults to the `STRATA_CACHE` env var (`0`/`off`/`false`/`no`
   * disable it), otherwise on.
   */
  enabled?: boolean;
  /** Database file. Overrides `dir`. */
  path?: string;
  /**
   * Directory to hold `cache.db`. Defaults to `$STRATA_CACHE_DIR`, else
   * `<cwd>/.strata`. Never the analysed repo — those are mounted read-only.
   */
  dir?: string;
  /** Drop entries untouched for this long, on open. 0 disables pruning. */
  maxAgeDays?: number;
  /** Where to report a cache that could not be opened. */
  log?: Logger;
}

export interface AnalysisCache {
  /** The database file backing this cache, or `null` when disabled. */
  readonly path: string | null;
  /** A `PluginCache` bound to one plugin — what `RepoContext.cache` gets. */
  scope(pluginId: string, version: string): PluginCache;
  /** Whole-run result lookup; `undefined` on a miss. */
  getRun<T>(pluginId: string, version: string, runKey: string): T | undefined;
  setRun(
    pluginId: string,
    version: string,
    runKey: string,
    value: unknown,
  ): void;
  /** Commit everything buffered since the last flush. */
  flush(): void;
  /** Drop entries that have not been used for `maxAgeMs`. */
  prune(maxAgeMs: number): void;
  stats(): CacheStats;
  /** Forget everything (keeps the file). */
  clear(): void;
  close(): void;
}

const DISABLED_VALUES = new Set(['0', 'off', 'false', 'no']);

const consoleLog: Logger = {
  debug: (m, meta) => console.debug(`[strata:cache] ${m}`, meta ?? ''),
  info: (m, meta) => console.info(`[strata:cache] ${m}`, meta ?? ''),
  warn: (m, meta) => console.warn(`[strata:cache] ${m}`, meta ?? ''),
  error: (m, meta) => console.error(`[strata:cache] ${m}`, meta ?? ''),
};

/**
 * Open the cache. Never throws: an unwritable location (read-only container,
 * missing permissions) degrades to a pass-through cache and a warning, because
 * a broken cache must not fail an analysis.
 */
export function openAnalysisCache(opts: CacheOptions = {}): AnalysisCache {
  const log = opts.log ?? consoleLog;
  if (!cacheEnabled(opts.enabled)) return nullCache();

  const file =
    opts.path ??
    resolve(opts.dir ?? process.env.STRATA_CACHE_DIR ?? '.strata', 'cache.db');
  try {
    return new SqliteAnalysisCache(file, opts.maxAgeDays ?? 30);
  } catch (err) {
    log.warn(
      `disabled — could not open ${file}: ${(err as Error).message}`,
    );
    return nullCache();
  }
}

function cacheEnabled(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const env = process.env.STRATA_CACHE?.trim().toLowerCase();
  return !(env && DISABLED_VALUES.has(env));
}

/** A cache that caches nothing — used when disabled or unavailable. */
export function nullCache(): AnalysisCache {
  const stats: CacheStats = {
    hits: 0,
    misses: 0,
    runHits: 0,
    runMisses: 0,
    writes: 0,
  };
  return {
    path: null,
    scope: () => ({
      file: (file, compute) => {
        stats.misses++;
        return compute(file);
      },
    }),
    getRun: () => {
      stats.runMisses++;
      return undefined;
    },
    setRun: () => {},
    flush: () => {},
    prune: () => {},
    stats: () => ({ ...stats }),
    clear: () => {},
    close: () => {},
  };
}

interface PendingWrite {
  pluginId: string;
  version: string;
  key: string;
  value: string;
}

class SqliteAnalysisCache implements AnalysisCache {
  readonly path: string;

  private readonly db: DatabaseSync;
  private readonly selectFile: StatementSync;
  private readonly insertFile: StatementSync;
  private readonly touchFile: StatementSync;
  private readonly selectRun: StatementSync;
  private readonly insertRun: StatementSync;
  private readonly touchRun: StatementSync;

  /** Writes and hits are buffered, then committed in one transaction. */
  private readonly pendingFiles = new Map<string, PendingWrite>();
  private readonly pendingRuns = new Map<string, PendingWrite>();
  private readonly touched = { files: new Set<string>(), runs: new Set<string>() };

  private readonly counters: CacheStats = {
    hits: 0,
    misses: 0,
    runHits: 0,
    runMisses: 0,
    writes: 0,
  };

  constructor(path: string, maxAgeDays: number) {
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);

    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    // Several analyses (or several server workers) may share the file.
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.migrate();

    this.selectFile = this.db.prepare(
      'SELECT value FROM file_cache WHERE plugin_id = ? AND version = ? AND blob = ?',
    );
    this.insertFile = this.db.prepare(
      `INSERT INTO file_cache (plugin_id, version, blob, value, used_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (plugin_id, version, blob)
       DO UPDATE SET value = excluded.value, used_at = excluded.used_at`,
    );
    this.touchFile = this.db.prepare(
      'UPDATE file_cache SET used_at = ? WHERE plugin_id = ? AND version = ? AND blob = ?',
    );
    this.selectRun = this.db.prepare(
      'SELECT value FROM run_cache WHERE plugin_id = ? AND version = ? AND run_key = ?',
    );
    this.insertRun = this.db.prepare(
      `INSERT INTO run_cache (plugin_id, version, run_key, value, used_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (plugin_id, version, run_key)
       DO UPDATE SET value = excluded.value, used_at = excluded.used_at`,
    );
    this.touchRun = this.db.prepare(
      'UPDATE run_cache SET used_at = ? WHERE plugin_id = ? AND version = ? AND run_key = ?',
    );

    if (maxAgeDays > 0) this.prune(maxAgeDays * 86_400_000);
  }

  /** Create the tables, wiping first if the file predates this schema. */
  private migrate(): void {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
    );
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value?: string } | undefined;

    if (row?.value !== undefined && row.value !== SCHEMA_VERSION) {
      this.db.exec('DROP TABLE IF EXISTS file_cache');
      this.db.exec('DROP TABLE IF EXISTS run_cache');
    }
    this.db.exec(SCHEMA);
    this.db
      .prepare(
        `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      )
      .run(SCHEMA_VERSION);
  }

  scope(pluginId: string, version: string): PluginCache {
    return {
      file: async <T>(
        file: RepoFile,
        compute: (file: RepoFile) => Promise<T>,
      ): Promise<T> => {
        const key = entryKey(pluginId, version, file.blob);
        const cached = this.readFile(pluginId, version, file.blob, key);
        if (cached !== undefined) {
          this.counters.hits++;
          return cached as T;
        }
        this.counters.misses++;
        const value = await compute(file);
        this.pendingFiles.set(key, {
          pluginId,
          version,
          key: file.blob,
          value: JSON.stringify(value) ?? 'null',
        });
        this.counters.writes++;
        return value;
      },
    };
  }

  private readFile(
    pluginId: string,
    version: string,
    blob: string,
    key: string,
  ): unknown {
    // Written earlier in this same run (two paths can share one blob).
    const pending = this.pendingFiles.get(key);
    if (pending) return parse(pending.value);

    const row = this.selectFile.get(pluginId, version, blob) as
      | { value: string }
      | undefined;
    if (row === undefined) return undefined;
    this.touched.files.add(key);
    return parse(row.value);
  }

  getRun<T>(pluginId: string, version: string, runKey: string): T | undefined {
    const key = entryKey(pluginId, version, runKey);
    const pending = this.pendingRuns.get(key);
    const value =
      pending !== undefined
        ? parse(pending.value)
        : parse(
            (
              this.selectRun.get(pluginId, version, runKey) as
                | { value: string }
                | undefined
            )?.value,
          );

    if (value === undefined) {
      this.counters.runMisses++;
      return undefined;
    }
    this.counters.runHits++;
    if (pending === undefined) this.touched.runs.add(key);
    return value as T;
  }

  setRun(
    pluginId: string,
    version: string,
    runKey: string,
    value: unknown,
  ): void {
    this.pendingRuns.set(entryKey(pluginId, version, runKey), {
      pluginId,
      version,
      key: runKey,
      value: JSON.stringify(value) ?? 'null',
    });
    this.counters.writes++;
  }

  flush(): void {
    const pending =
      this.pendingFiles.size +
      this.pendingRuns.size +
      this.touched.files.size +
      this.touched.runs.size;
    if (pending === 0) return;

    const now = Date.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const w of this.pendingFiles.values()) {
        this.insertFile.run(w.pluginId, w.version, w.key, w.value, now);
      }
      for (const w of this.pendingRuns.values()) {
        this.insertRun.run(w.pluginId, w.version, w.key, w.value, now);
      }
      // Keep entries this run used alive, so `prune` only drops cold ones.
      for (const key of this.touched.files) {
        const [pluginId, version, blob] = splitKey(key);
        this.touchFile.run(now, pluginId, version, blob);
      }
      for (const key of this.touched.runs) {
        const [pluginId, version, runKey] = splitKey(key);
        this.touchRun.run(now, pluginId, version, runKey);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    this.pendingFiles.clear();
    this.pendingRuns.clear();
    this.touched.files.clear();
    this.touched.runs.clear();
  }

  /** Drop entries untouched for `maxAgeMs`; `prune(0)` empties the cache. */
  prune(maxAgeMs: number): void {
    const cutoff = Date.now() - maxAgeMs;
    this.db.prepare('DELETE FROM file_cache WHERE used_at <= ?').run(cutoff);
    this.db.prepare('DELETE FROM run_cache WHERE used_at <= ?').run(cutoff);
  }

  stats(): CacheStats {
    return { ...this.counters };
  }

  clear(): void {
    this.pendingFiles.clear();
    this.pendingRuns.clear();
    this.touched.files.clear();
    this.touched.runs.clear();
    this.db.exec('DELETE FROM file_cache');
    this.db.exec('DELETE FROM run_cache');
  }

  close(): void {
    try {
      this.flush();
    } finally {
      this.db.close();
    }
  }
}

/** `\x1f` cannot occur in a plugin id, a version or a sha. */
const KEY_SEP = '\x1f';

function entryKey(pluginId: string, version: string, key: string): string {
  return `${pluginId}${KEY_SEP}${version}${KEY_SEP}${key}`;
}

function splitKey(key: string): [string, string, string] {
  const [pluginId, version, rest] = key.split(KEY_SEP);
  return [pluginId!, version!, rest!];
}

/** A row we cannot read is a miss, not a crash. */
function parse(value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Content digest of a file set — `(path, blob)` for every file, order-independent.
 * Two runs with the same digest see byte-identical inputs, which is what makes
 * a whole-run cache entry safe to reuse.
 */
export function filesDigest(files: readonly RepoFile[]): string {
  const hash = createHash('sha256');
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    hash.update(`${f.path}\0${f.blob}\n`);
  }
  return hash.digest('hex');
}

/** Digest of arbitrary key parts, for run keys that mix in more than files. */
export function digest(parts: readonly (string | number | undefined)[]): string {
  const hash = createHash('sha256');
  for (const p of parts) hash.update(`${p ?? ''}\0`);
  return hash.digest('hex');
}
