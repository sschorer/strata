import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { Logger } from '@strata/sdk';
import { consoleLogger } from '../logger.js';
import { withAppDefaults } from './defaults.js';
import { applyAppPatch } from './patch.js';
import { configure, migrate } from './schema.js';
import type {
  AppSettings,
  AppSettingsPatch,
  SettingsStore,
  StoredAppSettings,
} from './types.js';

/**
 * The persistent app settings: one SQLite file of its own, beside `cache.db`
 * and `projects.db`. Not a table in the registry — the registry's schema is the
 * one that grows with every project feature, and a migration there must not be
 * able to cost somebody their provider configuration.
 *
 * Failures are *not* swallowed the way the cache swallows its own: a "Save"
 * that reports success and stores nothing loses user intent, so a write that
 * fails throws and the API turns it into an error the user can see.
 */
export class SqliteSettingsStore implements SettingsStore {
  readonly path: string;

  private readonly db: DatabaseSync;
  private readonly select: StatementSync;
  private readonly upsert: StatementSync;

  constructor(
    path: string,
    private readonly log: Logger = consoleLogger,
  ) {
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);

    try {
      configure(this.db);
      migrate(this.db);
    } catch (err) {
      // A file this build will not touch (see `schema.ts`) still leaves an open
      // handle and its WAL sidecars behind if we only rethrow.
      this.db.close();
      throw err;
    }

    this.select = this.db.prepare('SELECT value FROM settings WHERE id = 1');
    this.upsert = this.db.prepare(
      `INSERT INTO settings (id, value) VALUES (1, ?)
       ON CONFLICT (id) DO UPDATE SET value = excluded.value`,
    );
  }

  get(): AppSettings {
    return withAppDefaults(this.stored());
  }

  patch(patch: AppSettingsPatch): AppSettings {
    const stored = applyAppPatch(this.stored(), patch);
    this.upsert.run(JSON.stringify(stored));
    return withAppDefaults(stored);
  }

  /** Only what was explicitly set; the defaults are applied on the way out. */
  private stored(): StoredAppSettings {
    const row = this.select.get() as { value: string } | undefined;
    if (row === undefined) return {};
    try {
      return JSON.parse(row.value) as StoredAppSettings;
    } catch (err) {
      // Unreadable settings fall back to the defaults rather than failing the
      // screen that reads them; the next PATCH overwrites the bad row. Every
      // setting silently reverting is worth saying out loud, though.
      this.log.warn(
        `settings in ${this.path} could not be read and are being ignored: ${
          (err as Error).message
        }`,
      );
      return {};
    }
  }

  close(): void {
    this.db.close();
  }
}
