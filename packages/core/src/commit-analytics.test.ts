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
 * End-to-end proof that a run carries the aggregates over its own history: a
 * real repository, dated commits, and the convention plugin the registry
 * loaded — the numbers the *Commit analytics* screen reads, straight off the
 * report rather than off a hand-built log.
 */

/** A conventional parser, small enough to keep the fixture readable. */
const PLUGIN_SOURCE = `const HEADER = /^(\\w+)(?:\\(([^)]+)\\))?(!)?: (.+)$/;

export default {
  kind: 'commit-convention',
  convention: 'test-conventional',
  parse(commit) {
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
  },
};
`;

let repo: string;
let pluginDir: string;
let strata: Strata;

/** Commit `message`, authored at `date`, so the weekly series has weeks. */
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

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-commits-'));
  pluginDir = mkdtempSync(join(tmpdir(), 'strata-convention-'));

  mkdirSync(join(pluginDir, 'dist'), { recursive: true });
  writeFileSync(join(pluginDir, 'dist/index.mjs'), PLUGIN_SOURCE);
  writeFileSync(
    join(pluginDir, 'strata.plugin.json'),
    JSON.stringify({
      id: 'test-convention',
      name: 'test-convention',
      kind: 'commit-convention',
      version: '1.0.0',
      sdk: '0.1.0',
      main: './dist/index.mjs',
    }),
  );

  await exec('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  // Two weeks apart, with the week between them left empty on purpose.
  await commit('feat(core): one', '2024-03-06T12:00:00+00:00');
  await commit('fix(core): two', '2024-03-07T12:00:00+00:00');
  await commit('feat(web)!: three', '2024-03-08T12:00:00+00:00');
  await commit('nothing conventional here', '2024-03-20T12:00:00+00:00');

  const registry = new PluginRegistry();
  await registry.loadFrom(join(pluginDir, 'strata.plugin.json'));
  strata = new Strata(registry, { cache: false });
}, 30_000);

afterAll(() => {
  strata.close();
  for (const dir of [repo, pluginDir]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('commit analytics', () => {
  it('folds the analysed window the registered convention parsed', async () => {
    const { commitAnalytics: analytics } = await strata.analyze({ root: repo });

    expect(analytics.total).toBe(4);
    expect(analytics.valid).toBe(3);
    expect(analytics.invalid).toBe(1);
    expect(analytics.validRate).toBe(0.75);
    expect(analytics.breaking).toBe(1);
    expect(analytics.types.map((b) => [b.name, b.count])).toEqual([
      ['feat', 2],
      ['fix', 1],
      [null, 1],
    ]);
    expect(analytics.scopes.map((b) => [b.name, b.count])).toEqual([
      ['core', 2],
      ['web', 1],
      [null, 1],
    ]);
  });

  it('dates the activity series by the commits git reported', async () => {
    const { commitAnalytics: analytics } = await strata.analyze({ root: repo });

    expect(analytics.weeks).toEqual([
      { week: '2024-03-04', commits: 3 },
      { week: '2024-03-11', commits: 0 },
      { week: '2024-03-18', commits: 1 },
    ]);
  });

  it('counts only the window a history limit asked for', async () => {
    const { commitAnalytics: analytics } = await strata.analyze({
      root: repo,
      historyLimit: 2,
    });

    // `git log` walks newest first, so the limit keeps the last two commits.
    expect(analytics.total).toBe(2);
    expect(analytics.weeks).toHaveLength(3);
    expect(analytics.types.map((b) => b.name)).toEqual(['feat', null]);
  });
});
