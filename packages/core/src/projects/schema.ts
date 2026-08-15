import type { DatabaseSync } from 'node:sqlite';

/**
 * Bump when the table layout changes — and write the migration. Unlike the
 * cache, this file holds data nobody can recompute, so a mismatch never wipes.
 */
export const SCHEMA_VERSION = 2;

const TABLES = `
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  root          TEXT    NOT NULL UNIQUE,
  added_at      TEXT    NOT NULL,
  -- Registration order, which added_at alone cannot give: two projects added
  -- in the same millisecond carry the same timestamp.
  seq           INTEGER NOT NULL,
  -- The last run's summary as JSON, or NULL until this project is analysed.
  last_analysis TEXT
) WITHOUT ROWID;

-- Schema 2. One row per configured project, holding only the settings that
-- were explicitly set: defaults are applied on read, so a default that moves
-- in a later release reaches every project that never overrode it.
CREATE TABLE IF NOT EXISTS project_config (
  project_id TEXT PRIMARY KEY,
  value      TEXT NOT NULL
) WITHOUT ROWID;
`;

/** Pragmas for a small, durable, occasionally-shared file. */
export function configure(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode = WAL');
  // Registry writes are rare and user-initiated: durability beats throughput.
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA busy_timeout = 5000');
}

/**
 * Create the tables and stamp the schema version.
 *
 * Every version so far only *adds* tables, so an older file needs nothing but
 * the `CREATE TABLE IF NOT EXISTS` run and a new stamp; a version that changes
 * an existing table has to bring its own `ALTER`s here.
 *
 * A file written by a *newer* Strata is left untouched and reported: opening it
 * with this build's expectations would either fail confusingly or quietly drop
 * columns the newer build still needs. The caller degrades to an in-memory
 * registry, so the workbench still runs — it just does not persist.
 */
export function migrate(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  );
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value?: string } | undefined;
  const found = Number(row?.value ?? SCHEMA_VERSION);

  if (found > SCHEMA_VERSION) {
    throw new Error(
      `project registry is at schema ${found}, but this build understands ${SCHEMA_VERSION} — ` +
        'it was written by a newer Strata.',
    );
  }

  db.exec(TABLES);
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  ).run(String(SCHEMA_VERSION));
}
