import type { DatabaseSync } from 'node:sqlite';

/** Bump when the table layout changes; a mismatch wipes and rebuilds the file. */
export const SCHEMA_VERSION = '1';

const TABLES = `
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

/** Apply the pragmas a shared, crash-safe cache file needs. */
export function configure(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  // Several analyses (or several server workers) may share the file.
  db.exec('PRAGMA busy_timeout = 5000');
}

/** Create the tables, wiping first if the file predates this schema. */
export function migrate(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  );
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value?: string } | undefined;

  if (row?.value !== undefined && row.value !== SCHEMA_VERSION) {
    db.exec('DROP TABLE IF EXISTS file_cache');
    db.exec('DROP TABLE IF EXISTS run_cache');
  }
  db.exec(TABLES);
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  ).run(SCHEMA_VERSION);
}
