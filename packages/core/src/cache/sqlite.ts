import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { Logger, PluginCache, RepoFile } from '@strata/sdk';
import { deserialize, serialize } from './json.js';
import { entryKey, splitKey } from './keys.js';
import { configure, migrate } from './schema.js';
import { emptyStats } from './stats.js';
import type { AnalysisCache, CacheStats } from './types.js';

/** One buffered row, waiting for the next flush. */
interface PendingWrite {
  pluginId: string;
  version: string;
  key: string;
  value: string;
}

/**
 * The real cache: both levels in one SQLite file, via `node:sqlite` so the
 * runtime keeps no dependency and needs no native build.
 *
 * Writes and hits are buffered and committed in one transaction per flush —
 * thousands of single-row transactions would cost more than the analysis.
 *
 * Nothing in here throws at its caller: a database that goes bad mid-run
 * (SQLITE_BUSY past the timeout, a full or read-only disk) degrades to a
 * pass-through, costing a recomputation rather than the analysis.
 */
export class SqliteAnalysisCache implements AnalysisCache {
  readonly path: string;

  private readonly db: DatabaseSync;
  private readonly selectFile: StatementSync;
  private readonly insertFile: StatementSync;
  private readonly touchFile: StatementSync;
  private readonly selectRun: StatementSync;
  private readonly insertRun: StatementSync;
  private readonly touchRun: StatementSync;

  private readonly pendingFiles = new Map<string, PendingWrite>();
  private readonly pendingRuns = new Map<string, PendingWrite>();
  private readonly touched = {
    files: new Set<string>(),
    runs: new Set<string>(),
  };

  private readonly counters: CacheStats = emptyStats();

  /** Set once the database has failed; keeps the warning to one per run. */
  private degraded = false;

  constructor(
    path: string,
    maxAgeDays: number,
    private readonly log: Logger,
  ) {
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);

    configure(this.db);
    migrate(this.db);

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
          value: serialize(value),
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
    if (pending) return deserialize(pending.value);

    const row = this.read(() => this.selectFile.get(pluginId, version, blob)) as
      | { value: string }
      | undefined;
    if (row === undefined) return undefined;
    this.touched.files.add(key);
    return deserialize(row.value);
  }

  /** A read that fails is a miss — never an error the analysis has to handle. */
  private read(query: () => unknown): unknown {
    try {
      return query();
    } catch (err) {
      this.degrade('read', err);
      return undefined;
    }
  }

  private degrade(op: string, err: unknown): void {
    if (this.degraded) return;
    this.degraded = true;
    this.log.warn(
      `${op} failed on ${this.path}; continuing without the cache: ` +
        (err as Error).message,
    );
  }

  getRun<T>(pluginId: string, version: string, runKey: string): T | undefined {
    const key = entryKey(pluginId, version, runKey);
    const pending = this.pendingRuns.get(key);
    const value =
      pending !== undefined
        ? deserialize(pending.value)
        : deserialize(
            (
              this.read(() =>
                this.selectRun.get(pluginId, version, runKey),
              ) as { value: string } | undefined
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
      value: serialize(value),
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
    try {
      this.db.exec('BEGIN IMMEDIATE');
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
      // A write that fails (SQLITE_BUSY past the timeout, a full or read-only
      // disk) costs a recomputation next run — it must not fail this analysis.
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Already rolled back; the original error is the interesting one.
      }
      this.degrade(`write of ${pending} entries`, err);
    } finally {
      this.forgetBuffered();
    }
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
    this.forgetBuffered();
    this.db.exec('DELETE FROM file_cache');
    this.db.exec('DELETE FROM run_cache');
  }

  close(): void {
    try {
      this.flush();
    } finally {
      try {
        this.db.close();
      } catch (err) {
        this.degrade('close', err);
      }
    }
  }

  private forgetBuffered(): void {
    this.pendingFiles.clear();
    this.pendingRuns.clear();
    this.touched.files.clear();
    this.touched.runs.clear();
  }
}
