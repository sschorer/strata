import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { DuplicateRootError } from './errors.js';
import { projectId } from './id.js';
import { normalizeInput } from './input.js';
import { configure, migrate } from './schema.js';
import type {
  Project,
  ProjectAnalysis,
  ProjectInput,
  ProjectStore,
} from './types.js';

/** One row of `projects`, as SQLite hands it back. */
interface Row {
  id: string;
  name: string;
  root: string;
  added_at: string;
  seq: number;
  last_analysis: string | null;
}

/**
 * The persistent registry: one SQLite file, separate from `cache.db` so that
 * emptying the cache — or a schema bump that wipes it — can never cost someone
 * their list of projects.
 *
 * Failures here are *not* swallowed the way the cache swallows its own. A cache
 * miss costs a recomputation, but an "Add project" that reports success and
 * stores nothing loses user intent, so a write that fails throws and the API
 * turns it into an error the user can see.
 */
export class SqliteProjectStore implements ProjectStore {
  readonly path: string;

  private readonly db: DatabaseSync;
  private readonly selectAll: StatementSync;
  private readonly selectById: StatementSync;
  private readonly selectByRoot: StatementSync;
  private readonly insert: StatementSync;
  private readonly updateAnalysis: StatementSync;
  private readonly deleteById: StatementSync;

  constructor(path: string) {
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new DatabaseSync(this.path);

    configure(this.db);
    migrate(this.db);

    // Registration order is the switcher's order: stable, and it does not move
    // under the reader when a project is analysed.
    this.selectAll = this.db.prepare('SELECT * FROM projects ORDER BY seq');
    this.selectById = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    this.selectByRoot = this.db.prepare(
      'SELECT * FROM projects WHERE root = ?',
    );
    this.insert = this.db.prepare(
      `INSERT INTO projects (id, name, root, added_at, seq, last_analysis)
       VALUES (?, ?, ?, ?, (SELECT IFNULL(MAX(seq), 0) + 1 FROM projects), ?)`,
    );
    this.updateAnalysis = this.db.prepare(
      'UPDATE projects SET last_analysis = ? WHERE id = ?',
    );
    this.deleteById = this.db.prepare('DELETE FROM projects WHERE id = ?');
  }

  list(): Project[] {
    return (this.selectAll.all() as unknown as Row[]).map(toProject);
  }

  get(id: string): Project | undefined {
    return one(this.selectById.get(id));
  }

  findByRoot(root: string): Project | undefined {
    return one(this.selectByRoot.get(resolve(root)));
  }

  add(input: ProjectInput): Project {
    const { name, root } = normalizeInput(input);
    const existing = this.findByRoot(root);
    if (existing) throw new DuplicateRootError(root, existing);

    const project: Project = {
      id: projectId(name, (candidate) => this.get(candidate) !== undefined),
      name,
      root,
      addedAt: new Date().toISOString(),
      lastAnalysis: null,
    };
    try {
      this.insert.run(
        project.id,
        project.name,
        project.root,
        project.addedAt,
        null,
      );
    } catch (err) {
      // Another writer registered this root between the check and the insert.
      const raced = this.findByRoot(root);
      if (raced) throw new DuplicateRootError(root, raced);
      throw err;
    }
    return project;
  }

  recordAnalysis(id: string, analysis: ProjectAnalysis): Project | undefined {
    if (!this.get(id)) return undefined;
    this.updateAnalysis.run(JSON.stringify(analysis), id);
    return this.get(id);
  }

  remove(id: string): boolean {
    return Number(this.deleteById.run(id).changes) > 0;
  }

  close(): void {
    this.db.close();
  }
}

/** One row, or nothing — `node:sqlite` types a result as a bag of columns. */
function one(row: unknown): Project | undefined {
  return row === undefined ? undefined : toProject(row as Row);
}

function toProject(row: Row): Project {
  return {
    id: row.id,
    name: row.name,
    root: row.root,
    addedAt: row.added_at,
    lastAnalysis: parseAnalysis(row.last_analysis),
  };
}

/** A summary we cannot read is a project that has not been analysed yet. */
function parseAnalysis(value: string | null): ProjectAnalysis | null {
  if (value === null) return null;
  try {
    return JSON.parse(value) as ProjectAnalysis;
  } catch {
    return null;
  }
}
