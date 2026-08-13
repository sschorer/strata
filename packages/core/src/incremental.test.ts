import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Strata } from './index.js';
import { PluginRegistry } from './registry.js';

const exec = promisify(execFile);

/**
 * End-to-end proof of the incremental path: analyse a real git repo twice and
 * assert the second run recomputes nothing, then change one file and assert
 * only that file is recomputed.
 */

/** The stub plugin counts its per-file work here, in the shared realm. */
declare global {
  var __strataScans: string[] | undefined;
}

const PLUGIN_SOURCE = `export default {
  kind: 'language',
  extensions: ['ts'],
  async analyze(ctx) {
    const nodes = [];
    for (const file of ctx.files) {
      const loc = await ctx.cache.file(file, async (f) => {
        (globalThis.__strataScans ??= []).push(f.path);
        return (await f.read()).split('\\n').length;
      });
      nodes.push({ id: file.path, label: file.path, kind: 'file', meta: { loc } });
    }
    return { graph: { nodes, edges: [], cycles: [] }, deadCode: [], metrics: [] };
  },
};
`;

let repo: string;
let cacheDir: string;
let pluginDir: string;
let strata: Strata;

async function git(args: string[]): Promise<void> {
  await exec('git', args, {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Strata Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Strata Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

async function commit(files: Record<string, string>, message: string) {
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(repo, name), body);
  }
  await git(['add', '-A']);
  await git(['commit', '-m', message]);
}

/** Files scanned since the last call. */
function scans(): string[] {
  const seen = globalThis.__strataScans ?? [];
  globalThis.__strataScans = [];
  return seen;
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-repo-'));
  cacheDir = mkdtempSync(join(tmpdir(), 'strata-cache-'));
  pluginDir = mkdtempSync(join(tmpdir(), 'strata-plugin-'));

  mkdirSync(join(pluginDir, 'dist'), { recursive: true });
  writeFileSync(join(pluginDir, 'dist/index.mjs'), PLUGIN_SOURCE);
  writeFileSync(
    join(pluginDir, 'strata.plugin.json'),
    JSON.stringify({
      id: 'test-language',
      name: 'test-language',
      kind: 'language',
      version: '1.0.0',
      sdk: '0.1.0',
      main: './dist/index.mjs',
    }),
  );

  await exec('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  await commit(
    { 'a.ts': 'export const a = 1;\n', 'b.ts': 'export const b = 2;\n' },
    'feat: initial',
  );

  const registry = new PluginRegistry();
  await registry.loadFrom(join(pluginDir, 'strata.plugin.json'));
  strata = new Strata(registry, { cache: { dir: cacheDir } });
}, 30_000);

afterAll(() => {
  strata.close();
  for (const dir of [repo, cacheDir, pluginDir]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('incremental analysis', () => {
  it('computes every file on a cold cache', async () => {
    const report = await strata.analyze({ root: repo });

    expect(scans().sort()).toEqual(['a.ts', 'b.ts']);
    expect(report.cache).toMatchObject({
      enabled: true,
      hits: 0,
      misses: 2,
      runHits: 0,
    });
  });

  it('skips the plugin entirely when nothing changed', async () => {
    const first = await strata.analyze({ root: repo });
    const second = await strata.analyze({ root: repo });

    expect(scans()).toEqual([]);
    expect(second.cache).toMatchObject({ runHits: 1, misses: 0 });
    expect(second.languages).toEqual(first.languages);
  });

  it('recomputes only the file that changed', async () => {
    await commit({ 'b.ts': 'export const b = 2;\nexport const c = 3;\n' }, 'fix: b');

    const report = await strata.analyze({ root: repo });

    expect(scans()).toEqual(['b.ts']); // a.ts came from the cache
    expect(report.cache).toMatchObject({ hits: 1, misses: 1, runHits: 0 });
    expect(report.languages.ts?.graph.nodes).toContainEqual({
      id: 'b.ts',
      label: 'b.ts',
      kind: 'file',
      meta: { loc: 3 },
    });
  });

  it('recomputes everything when the caller opts out', async () => {
    const report = await strata.analyze({ root: repo, cache: false });

    expect(scans().sort()).toEqual(['a.ts', 'b.ts']);
    expect(report.cache.enabled).toBe(false);
  });

  it('recomputes everything after the cache is cleared', async () => {
    strata.clearCache();
    const report = await strata.analyze({ root: repo });

    expect(scans().sort()).toEqual(['a.ts', 'b.ts']);
    expect(report.cache).toMatchObject({ hits: 0, misses: 2, runHits: 0 });
  });
});
