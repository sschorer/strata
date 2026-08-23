import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PluginRegistry } from './registry.js';
import { Strata } from './strata.js';

const exec = promisify(execFile);

/**
 * End-to-end proof that a run reads its own history: a real repository with
 * dated commits, a convention **stage** that parses the window it is handed,
 * and a fold **stage** that counts what the convention made of it — the path
 * from `git log` to `report.commitAnalytics`, over a repository rather than
 * over a hand-built log.
 *
 * Both fixtures are deliberately small. What the built-in fold counts is its
 * own package's business (`plugins/commit-fold`); what is being proved here is
 * that a run hands a convention the window it actually analysed, and hands the
 * fold what the convention said about it.
 */

/** A conventional parser as a stage, small enough to keep the fixture readable. */
const CONVENTION = `const HEADER = /^(\\w+)(?:\\(([^)]+)\\))?(!)?: (.+)$/;

export default {
  kind: 'stage',
  async run(ctx) {
    return ctx.history.map((commit) => {
      const m = commit.message.split('\\n')[0].match(HEADER);
      if (!m) {
        return { type: null, scope: null, breaking: false, subject: commit.message, tags: {}, valid: false };
      }
      return {
        type: m[1],
        scope: m[2] ?? null,
        breaking: m[3] === '!',
        subject: m[4],
        tags: {},
        valid: true,
      };
    });
  },
};
`;

/** A fold: the window it was handed, and what the log upstream says about it. */
const FOLD = `export default {
  kind: 'stage',
  async run(ctx) {
    const parsed = Object.values(ctx.inputs.commits)[0] ?? [];
    return {
      total: ctx.history.length,
      valid: parsed.filter((c) => c.valid).length,
      invalid: parsed.filter((c) => !c.valid).length,
      validRate: 0,
      breaking: parsed.filter((c) => c.breaking).length,
      types: parsed.map((c) => c.type),
      scopes: parsed.map((c) => c.scope),
      weeks: [],
    };
  },
};
`;

let repo: string;
let plugins: string;
let strata: Strata;

/** Commit `message`, authored at `date`, so the window has dates and an order. */
async function commit(message: string, date: string): Promise<void> {
  writeFileSync(join(repo, 'file.txt'), message);
  await exec('git', ['add', '-A'], { cwd: repo });
  await exec('git', ['commit', '-m', message], {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Strata Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_NAME: 'Strata Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
      GIT_COMMITTER_DATE: date,
    },
  });
}

/** Write a stage out as a plugin directory and load it. */
async function install(
  registry: PluginRegistry,
  id: string,
  declared: Record<string, unknown>,
  source: string,
): Promise<void> {
  const dir = join(plugins, id);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist/index.mjs'), source);
  writeFileSync(
    join(dir, 'strata.plugin.json'),
    JSON.stringify({
      id,
      name: id,
      kind: 'stage',
      version: '1.0.0',
      sdk: '0.2.0',
      main: './dist/index.mjs',
      consumes: ['commits'],
      ...declared,
    }),
  );
  await registry.loadFrom(join(dir, 'strata.plugin.json'));
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-commits-'));
  plugins = mkdtempSync(join(tmpdir(), 'strata-commit-stages-'));

  await exec('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  // Two weeks apart, with the week between them left empty on purpose.
  await commit('feat(core): one', '2024-03-06T12:00:00+00:00');
  await commit('fix(core): two', '2024-03-07T12:00:00+00:00');
  await commit('feat(web)!: three', '2024-03-08T12:00:00+00:00');
  await commit('nothing conventional here', '2024-03-20T12:00:00+00:00');

  const registry = new PluginRegistry();
  await install(
    registry,
    'test-convention',
    { produces: 'commits', exclusive: 'commit-convention' },
    CONVENTION,
  );
  await install(registry, 'strata-commit-fold', { produces: 'aggregate' }, FOLD);
  strata = new Strata(registry, { cache: false });
}, 30_000);

afterAll(() => {
  strata.close();
  for (const dir of [repo, plugins]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('the analysed history window', () => {
  it('reaches the convention as the repository holds it, newest first', async () => {
    const { commits } = await strata.analyze({ root: repo });

    expect(commits.map((c) => c.type)).toEqual([null, 'feat', 'fix', 'feat']);
    expect(commits.map((c) => c.scope)).toEqual([null, 'web', 'core', 'core']);
    expect(commits.filter((c) => c.breaking)).toHaveLength(1);
    expect(commits.filter((c) => c.valid)).toHaveLength(3);
  });

  it('reaches the fold as the convention parsed it', async () => {
    const { commitAnalytics: analytics } = await strata.analyze({ root: repo });

    // The fold consumed a log it never asked for by name, over the same four
    // commits the convention was handed.
    expect(analytics.total).toBe(4);
    expect(analytics.valid).toBe(3);
    expect(analytics.invalid).toBe(1);
    expect(analytics.breaking).toBe(1);
    expect(analytics.types).toEqual([null, 'feat', 'fix', 'feat']);
  });

  it('is the window a history limit asked for, for both of them', async () => {
    const report = await strata.analyze({ root: repo, historyLimit: 2 });

    // `git log` walks newest first, so the limit keeps the last two commits.
    expect(report.commits.map((c) => c.type)).toEqual([null, 'feat']);
    expect(report.commitAnalytics.total).toBe(2);
  });
});
