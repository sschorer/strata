import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PluginRegistry } from '../registry.js';
import { Strata } from '../strata.js';
import type { AnalysisProgress } from './types.js';

const exec = promisify(execFile);

/**
 * What a run says about itself while it runs. The claim being tested is that it
 * is the *pipeline's* sequence and not a decoration: every plugin that takes
 * part is a step, a plugin that is skipped is not, and the totals a reader is
 * shown add up by the end.
 *
 * The repository holds one `.ts` file and no `.md` file, and two language
 * plugins are loaded — one that claims `ts` and one that claims `md`. The
 * second is the one nobody should be told to wait for.
 */

const LANGUAGE = (ext: string) => `export default {
  kind: 'language',
  extensions: ['${ext}'],
  async analyze(ctx) {
    return {
      graph: { nodes: [], edges: [], cycles: [] },
      deadCode: [],
      metrics: [],
    };
  },
};
`;

const METRIC = (id: string) => `export default {
  kind: 'git-metric',
  id: '${id}',
  async compute() {
    return { id: '${id}', label: '${id}', points: [] };
  },
};
`;

let repo: string;
let plugins: string;
let strata: Strata;

async function install(
  registry: PluginRegistry,
  id: string,
  kind: string,
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
      kind,
      version: '1.0.0',
      sdk: '0.1.0',
      main: './dist/index.mjs',
    }),
  );
  await registry.loadFrom(join(dir, 'strata.plugin.json'));
}

/** Every step of one run, in the order it was reported. */
async function stepsOf(
  options: Parameters<Strata['analyze']>[0] = { root: repo },
): Promise<AnalysisProgress[]> {
  const seen: AnalysisProgress[] = [];
  await strata.analyze(options, (progress) => seen.push(progress));
  return seen;
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-progress-repo-'));
  plugins = mkdtempSync(join(tmpdir(), 'strata-progress-plugins-'));

  await exec('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  writeFileSync(join(repo, 'a.ts'), 'export const a = 1;\n');
  await exec('git', ['add', '-A'], { cwd: repo });
  await exec('git', ['commit', '-m', 'feat: initial'], {
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
  await install(registry, 'lang-ts', 'language', LANGUAGE('ts'));
  await install(registry, 'lang-md', 'language', LANGUAGE('md'));
  await install(registry, 'metric-a', 'git-metric', METRIC('metric-a'));

  strata = new Strata(registry, { cache: false });
}, 30_000);

afterAll(() => {
  strata.close();
  for (const dir of [repo, plugins]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('analysis progress', () => {
  it('reports the pipeline in the order it runs', async () => {
    const steps = await stepsOf();

    expect(steps.map((s) => s.stage)).toEqual([
      'resolving',
      'scanning',
      'language',
      'history',
      'metric',
      'commits',
      'finished',
    ]);
  });

  it('names the plugin each per-plugin step is waiting on', async () => {
    const steps = await stepsOf();

    expect(steps.find((s) => s.stage === 'language')?.detail).toBe('lang-ts');
    expect(steps.find((s) => s.stage === 'metric')?.detail).toBe('metric-a');
  });

  it('does not count a plugin whose file types the repo does not hold', async () => {
    const steps = await stepsOf();

    // `lang-md` is loaded and enabled and still never runs, so nobody is told
    // to wait for it.
    expect(steps.filter((s) => s.stage === 'language')).toHaveLength(1);
  });

  it('admits it does not know the total until it has the file list', async () => {
    const steps = await stepsOf();

    // A total that shifted under the reader would be worse than none.
    expect(steps.slice(0, 2).map((s) => s.total)).toEqual([0, 0]);
    expect(steps[2]?.total).toBe(6);
  });

  it('counts every step it announced, and ends on all of them', async () => {
    const steps = await stepsOf();

    expect(steps.map((s) => s.completed)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const last = steps.at(-1);
    expect(last).toMatchObject({ stage: 'finished', completed: 6, total: 6 });
  });

  it('plans a narrower run for a project that enabled fewer plugins', async () => {
    const steps = await stepsOf({ root: repo, metrics: [] });

    expect(steps.some((s) => s.stage === 'metric')).toBe(false);
    expect(steps.at(-1)).toMatchObject({ completed: 5, total: 5 });
  });

  it('costs a run nothing when nobody is watching', async () => {
    // The pipeline is the same pipeline; the listener is the only difference.
    const watched = await stepsOf();
    const report = await strata.analyze({ root: repo });

    expect(watched).not.toHaveLength(0);
    expect(report.run.files).toBe(1);
  });
});
