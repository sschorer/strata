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
 * What a report says about the repository's imports, across every language that
 * analysed it. The fold is the core's, so the assertions here are on the report
 * a consumer receives rather than on the functions behind it.
 *
 * Two stub language plugins claim one extension each and hand back a fixed
 * graph: one knot in `.ts`, one import that leaves the file set in `.php`.
 */

/** A plugin whose graph is written into it — the analysis itself is not the point. */
const pluginSource = (extensions: string[], graph: unknown) => `export default {
  kind: 'language',
  extensions: ${JSON.stringify(extensions)},
  async analyze() {
    return { graph: ${JSON.stringify(graph)}, deadCode: [], metrics: [] };
  },
};
`;

const tsGraph = {
  nodes: [
    { id: 'a.ts', label: 'a.ts', kind: 'file' },
    { id: 'b.ts', label: 'b.ts', kind: 'file' },
  ],
  edges: [
    { from: 'a.ts', to: 'b.ts', kind: 'import' },
    { from: 'b.ts', to: 'a.ts', kind: 'import' },
  ],
  cycles: [['b.ts', 'a.ts']],
};

const phpGraph = {
  nodes: [{ id: 'a.php', label: 'a.php', kind: 'file' }],
  edges: [{ from: 'a.php', to: 'vendor/lib', kind: 'import' }],
  cycles: [],
};

let repo: string;
let pluginDir: string;
let strata: Strata;

function writePlugin(id: string, extensions: string[], graph: unknown): string {
  const dir = join(pluginDir, id);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist/index.mjs'), pluginSource(extensions, graph));
  writeFileSync(
    join(dir, 'strata.plugin.json'),
    JSON.stringify({
      id,
      name: id,
      kind: 'language',
      version: '1.0.0',
      sdk: '0.1.0',
      main: './dist/index.mjs',
    }),
  );
  return join(dir, 'strata.plugin.json');
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-deps-'));
  pluginDir = mkdtempSync(join(tmpdir(), 'strata-deps-plugins-'));

  await exec('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  for (const name of ['a.ts', 'b.ts', 'a.php']) {
    writeFileSync(join(repo, name), '// file\n');
  }
  await exec('git', ['add', '-A'], { cwd: repo });
  await exec('git', ['commit', '-q', '-m', 'feat: initial'], {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Strata Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Strata Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });

  const registry = new PluginRegistry();
  await registry.loadFrom(writePlugin('stub-ts', ['ts'], tsGraph));
  await registry.loadFrom(writePlugin('stub-php', ['php'], phpGraph));
  strata = new Strata(registry, { cache: false });
}, 30_000);

afterAll(() => {
  strata.close();
  for (const dir of [repo, pluginDir]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('the report’s dependency graph', () => {
  it('carries every language’s graph as one', async () => {
    const { dependencies } = await strata.analyze({ root: repo });

    expect(dependencies.nodes.map((node) => node.id).sort()).toEqual([
      'a.php',
      'a.ts',
      'b.ts',
      'vendor/lib',
    ]);
    expect(dependencies.edges).toHaveLength(3);
  });

  it('names the far end of an import that left the file set', async () => {
    const { dependencies } = await strata.analyze({ root: repo });

    expect(dependencies.nodes).toContainEqual({
      id: 'vendor/lib',
      label: 'vendor/lib',
      kind: 'package',
    });
  });

  it('reports a cycle as a path, not as a bag of files', async () => {
    const { dependencies } = await strata.analyze({ root: repo });

    expect(dependencies.cycles).toEqual([
      { nodes: ['a.ts', 'b.ts'], path: ['a.ts', 'b.ts', 'a.ts'] },
    ]);
  });

  it('summarises the whole repository, not one language of it', async () => {
    const { dependencies } = await strata.analyze({ root: repo });

    expect(dependencies.summary).toMatchObject({
      nodes: 3,
      edges: 3,
      cycles: 1,
      cycleNodes: 2,
    });
  });
});
