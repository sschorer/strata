import type { DatabaseSync } from 'node:sqlite';

/**
 * Bump when the table layout changes — and write the migration. Like the
 * project registry, this file holds data nobody can recompute, so a mismatch
 * never wipes.
 */
export const SCHEMA_VERSION = 1;

const TABLES = `
-- One workbench, one row. The settings live as JSON rather than a column per
-- field because they are read and written whole, and because a new section
-- (a new settings screen) should not be a migration.
CREATE TABLE IF NOT EXISTS settings (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL
);
`;

/** Pragmas for a small, durable, occasionally-shared file. */
export function configure(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode = WAL');
  // Settings writes are rare and user-initiated: durability beats throughput.
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA busy_timeout = 5000');
}

/**
 * Create the table and stamp the schema version.
 *
 * A file written by a *newer* Strata is left untouched and reported: opening it
 * with this build's expectations would either fail confusingly or quietly drop
 * settings the newer build still needs. The caller degrades to in-memory
 * settings, so the workbench still runs on its defaults — it just does not
 * persist what is changed.
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
      `app settings are at schema ${found}, but this build understands ${SCHEMA_VERSION} — ` +
        'they were written by a newer Strata.',
    );
  }

  db.exec(TABLES);
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  ).run(String(SCHEMA_VERSION));
}
