import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { StageFilter, OutputType } from '@strata/sdk';
import type { AnalysisProgress } from './progress/index.js';
import { PluginRegistry } from './registry.js';
import { Strata } from './strata.js';
import type { AnalysisReport } from './types.js';

const exec = promisify(execFile);

/**
 * The scheduler, driven the way a workbench drives it: real plugin directories
 * loaded through the registry, over a real repository, asked only what the
 * report says afterwards.
 *
 * Fixtures are on disk rather than hand-built registry entries on purpose. The
 * claim being tested is that a run is *planned from the manifests* — ordered,
 * filtered and rejected before any third-party code is imported — and a stage
 * assembled in the test would never exercise it (`docs/adr/0010`).
 *
 * The repository:
 *
 *   src/a.ts        src/b.ts        docs/note.md
 */

/** Every stage that actually ran, in order, across the current run. */
declare global {
  var __strataStageRuns: string[] | undefined;
}

/** A stage that says what it was handed, as an aggregate nobody narrows. */
const WITNESS = (id: string) => `export default {
  kind: 'stage',
  async run(ctx) {
    (globalThis.__strataStageRuns ??= []).push('${id}');
    return {
      files: ctx.files.map((f) => f.path).sort(),
      commits: ctx.history.length,
      inputs: Object.fromEntries(
        Object.entries(ctx.inputs)
          .filter(([, byProducer]) => Object.keys(byProducer).length > 0)
          .map(([type, byProducer]) => [type, Object.keys(byProducer).sort()]),
      ),
    };
  },
};
`;

/** A stage producing a dependency graph over whatever files it was given. */
const GRAPH = (id: string) => `export default {
  kind: 'stage',
  async run(ctx) {
    (globalThis.__strataStageRuns ??= []).push('${id}');
    return {
      nodes: ctx.files.map((f) => ({ id: f.path, label: f.path, kind: 'file' })),
      edges: [],
      cycles: [],
    };
  },
};
`;

/** A stage producing a metric series, one point per file it was handed. */
const SERIES = (id: string) => `export default {
  kind: 'stage',
  async run(ctx) {
    (globalThis.__strataStageRuns ??= []).push('${id}');
    return {
      id: '${id}',
      label: '${id}',
      points: ctx.files.map((f) => ({
        subject: f.path,
        value: ctx.history.length,
      })),
    };
  },
};
`;

/** What a fixture's manifest declares about its stage. */
interface Declarations {
  produces: OutputType;
  consumes?: OutputType[];
  filter?: StageFilter;
  version?: string;
}

let repo: string;
let plugins: string;

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

/** Write a stage out as a plugin directory and load it. */
async function install(
  registry: PluginRegistry,
  id: string,
  declarations: Declarations,
  source: string,
): Promise<void> {
  const { version = '1.0.0', ...declared } = declarations;
  const dir = join(plugins, id);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist/index.mjs'), source);
  writeFileSync(
    join(dir, 'strata.plugin.json'),
    JSON.stringify({
      id,
      name: id,
      kind: 'stage',
      version,
      sdk: '0.2.0',
      main: './dist/index.mjs',
      ...declared,
    }),
  );
  await registry.loadFrom(join(dir, 'strata.plugin.json'));
}

/** What one stage said it was handed. */
function witnessed(report: AnalysisReport, id: string): Record<string, unknown> {
  const entry = report.stages[id];
  if (entry?.status !== 'ok') throw new Error(`${id} did not run: ${entry?.status}`);
  return entry.output as Record<string, unknown>;
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-staged-repo-'));
  plugins = mkdtempSync(join(tmpdir(), 'strata-staged-plugins-'));

  await exec('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'docs'));
  writeFileSync(join(repo, 'src/a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'src/b.ts'), 'export const b = 2;\n');
  writeFileSync(join(repo, 'docs/note.md'), '# note\n');
  await git(['add', '-A']);
  await git(['commit', '-m', 'feat: initial']);
}, 30_000);

afterAll(() => {
  for (const dir of [repo, plugins]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  globalThis.__strataStageRuns = [];
});

describe('the order a run takes', () => {
  let strata: Strata;

  beforeAll(async () => {
    const registry = new PluginRegistry();
    // Loaded *before* the graph it consumes, so an order that came out right
    // came from the declarations rather than from who was installed first.
    await install(
      registry,
      'reads-graph',
      { produces: 'aggregate', consumes: ['graph'] },
      WITNESS('reads-graph'),
    );
    await install(
      registry,
      'makes-graph',
      { produces: 'graph', filter: { extensions: ['ts'] } },
      GRAPH('makes-graph'),
    );
    strata = new Strata(registry, { cache: false });
  });

  afterAll(() => strata.close());

  it('runs a producer before everyone consuming what it produces', async () => {
    await strata.analyze({ root: repo });

    expect(globalThis.__strataStageRuns).toEqual(['makes-graph', 'reads-graph']);
  });

  it('hands a stage every upstream output of a type it consumes, keyed by producer', async () => {
    const report = await strata.analyze({ root: repo });

    // By producing plugin id, never by anything the consumer had to know in
    // advance — which is what lets it work with a module written later.
    expect(witnessed(report, 'reads-graph').inputs).toEqual({
      graph: ['makes-graph'],
    });
  });

  it('hands a stage nothing of a type it did not declare', async () => {
    const report = await strata.analyze({ root: repo });

    // `makes-graph` declared no inputs at all, so nothing arrives for it —
    // an undeclared input is one its cache key does not cover.
    expect(witnessed(report, 'reads-graph').commits).toBe(0);
  });
});

describe('a configuration nothing can satisfy', () => {
  let strata: Strata;

  beforeAll(async () => {
    const registry = new PluginRegistry();
    await install(
      registry,
      'graph-from-metrics',
      { produces: 'graph', consumes: ['metrics'] },
      GRAPH('graph-from-metrics'),
    );
    await install(
      registry,
      'metrics-from-graph',
      { produces: 'metrics', consumes: ['graph'] },
      SERIES('metrics-from-graph'),
    );
    strata = new Strata(registry, { cache: false });
  });

  afterAll(() => strata.close());

  it('is refused, and not one stage runs', async () => {
    await expect(strata.analyze({ root: repo })).rejects.toThrow(
      /cannot be ordered/,
    );
    expect(globalThis.__strataStageRuns).toEqual([]);
  });
});

describe('the files a stage is given', () => {
  let strata: Strata;

  beforeAll(async () => {
    const registry = new PluginRegistry();
    await install(
      registry,
      'typescript',
      { produces: 'aggregate', filter: { extensions: ['ts'] } },
      WITNESS('typescript'),
    );
    await install(
      registry,
      'docs',
      { produces: 'aggregate', filter: { globs: ['docs/**'] } },
      WITNESS('docs'),
    );
    await install(
      registry,
      'python',
      { produces: 'aggregate', filter: { extensions: ['py'] } },
      WITNESS('python'),
    );
    await install(
      registry,
      'reads-no-files',
      { produces: 'aggregate' },
      WITNESS('reads-no-files'),
    );
    strata = new Strata(registry, { cache: false });
  });

  afterAll(() => strata.close());

  it('is what its filter matched, and the core matched it', async () => {
    const report = await strata.analyze({ root: repo });

    expect(witnessed(report, 'typescript').files).toEqual([
      'src/a.ts',
      'src/b.ts',
    ]);
    expect(witnessed(report, 'docs').files).toEqual(['docs/note.md']);
  });

  it('is none for a stage that declared no filter', async () => {
    const report = await strata.analyze({ root: repo });

    // It consumes what other stages produced; the tree is not its business.
    expect(witnessed(report, 'reads-no-files').files).toEqual([]);
  });

  it('skips a stage whose filter matched nothing, and says so', async () => {
    const report = await strata.analyze({ root: repo });

    expect(globalThis.__strataStageRuns).not.toContain('python');
    expect(report.stages.python).toEqual({
      status: 'skipped',
      type: 'aggregate',
      reason: expect.stringContaining('matched no file'),
    });
  });

  it('does not count a skipped stage as a step anyone waits for', async () => {
    const steps: AnalysisProgress[] = [];
    await strata.analyze({ root: repo }, (progress) => steps.push(progress));

    const staged = steps.filter((step) => step.stage === 'stage');
    expect(staged.map((step) => step.detail)).toEqual([
      'typescript',
      'docs',
      'reads-no-files',
    ]);
    // Two steps before the stages, the history read, the commit fold.
    expect(steps.at(-1)).toMatchObject({ completed: 7, total: 7 });
  });
});

describe('what the report carries', () => {
  let strata: Strata;

  beforeAll(async () => {
    const registry = new PluginRegistry();
    await install(
      registry,
      'hot',
      { produces: 'metrics', consumes: ['commits'], filter: { globs: ['**'] } },
      SERIES('hot'),
    );
    await install(
      registry,
      'nothing-to-do',
      { produces: 'aggregate', version: '2.3.1', filter: { extensions: ['py'] } },
      WITNESS('nothing-to-do'),
    );
    strata = new Strata(registry, { cache: false });
  });

  afterAll(() => strata.close());

  it('keys a stage entry by manifest id and carries the output only when it ran', async () => {
    const report = await strata.analyze({ root: repo });

    expect(report.stages.hot).toMatchObject({
      status: 'ok',
      type: 'metrics',
      output: { id: 'hot' },
    });
    expect(report.stages['nothing-to-do']).toMatchObject({ status: 'skipped' });
    expect(report.stages['nothing-to-do']).not.toHaveProperty('output');
  });

  it('records which stages the run ordered, and at which versions', async () => {
    const report = await strata.analyze({ root: repo });

    expect(report.provenance).toEqual([
      { id: 'hot', version: '1.0.0', status: 'ok' },
      { id: 'nothing-to-do', version: '2.3.1', status: 'skipped' },
    ]);
  });

  it('still fills in the field a metric series has always reached', async () => {
    const report = await strata.analyze({ root: repo });

    // What the hotspots screen reads. A stage's output lands where its kind's
    // output used to, so nothing downstream moves before the last plugin has.
    expect(report.metrics.map((series) => series.id)).toEqual(['hot']);
  });

  it('hands the run its history window when it consumes the commit log', async () => {
    const report = await strata.analyze({ root: repo });
    const entry = report.stages.hot;

    if (entry?.status !== 'ok') throw new Error('the stage did not run');
    // Each point's value is the length of the window the stage was handed:
    // one commit, and the same one for every file it scored.
    expect(entry.output).toMatchObject({
      points: [{ value: 1 }, { value: 1 }, { value: 1 }],
    });
  });

  it('leaves a stage out of a run its allow-list left out', async () => {
    const report = await strata.analyze({ root: repo, metrics: [] });

    expect(report.stages.hot).toBeUndefined();
    expect(report.metrics).toEqual([]);
  });

  it('fails a run naming a stage nobody loaded, as it does any plugin', async () => {
    await expect(
      strata.analyze({ root: repo, metrics: ['hot', 'gone'] }),
    ).rejects.toThrow(/"metrics" names git-metric plugin "gone"/);
  });
});

/**
 * What `consumes` and `filter` are worth once a run is over: a stage is asked
 * again only when something it was actually given has changed. The whole point
 * of the core applying the filter is that the key covers the matched files
 * rather than the tree (`docs/adr/0010`).
 */
describe("a stage's cache key", () => {
  let changing: string;
  let cacheDir: string;
  let strata: Strata;

  async function commit(name: string, body: string): Promise<void> {
    writeFileSync(join(changing, name), body);
    await exec('git', ['add', '-A'], { cwd: changing });
    await exec('git', ['commit', '-q', '-m', `chore: ${name}`], {
      cwd: changing,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Strata Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Strata Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    });
  }

  /** The stages that ran since the last call. */
  function ran(): string[] {
    const seen = globalThis.__strataStageRuns ?? [];
    globalThis.__strataStageRuns = [];
    return seen;
  }

  beforeAll(async () => {
    changing = mkdtempSync(join(tmpdir(), 'strata-staged-cache-repo-'));
    cacheDir = mkdtempSync(join(tmpdir(), 'strata-staged-cache-'));
    await exec('git', ['init', '-q', '-b', 'main'], { cwd: changing });
    mkdirSync(join(changing, 'docs'));
    writeFileSync(join(changing, 'src.ts'), 'export const a = 1;\n');
    await commit('docs/note.md', '# note\n');

    const registry = new PluginRegistry();
    await install(
      registry,
      'typed',
      { produces: 'aggregate', filter: { extensions: ['ts'] } },
      WITNESS('typed'),
    );
    await install(
      registry,
      'windowed',
      { produces: 'metrics', consumes: ['commits'], filter: { extensions: ['ts'] } },
      SERIES('windowed'),
    );
    strata = new Strata(registry, { cache: { dir: cacheDir } });
  }, 30_000);

  afterAll(() => {
    strata.close();
    for (const dir of [changing, cacheDir]) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is missed on a cold cache and hit when nothing moved', async () => {
    await strata.analyze({ root: changing });
    expect(ran()).toEqual(['typed', 'windowed']);

    const second = await strata.analyze({ root: changing });
    expect(ran()).toEqual([]);
    expect(second.cache.runHits).toBe(2);
    // A stage that never ran is still `ok` with its output: the cache answered
    // for it, which is not the same as it having nothing to say.
    expect(second.stages.typed).toMatchObject({ status: 'ok' });
  });

  it('survives a file the stage never asked for changing', async () => {
    await commit('docs/note.md', '# note\n\nmore\n');

    await strata.analyze({ root: changing });

    // The markdown edit is not in `typed`'s key, because it was never in
    // `typed`'s files. `windowed` reads the commit log, so its window moved.
    expect(ran()).toEqual(['windowed']);
  });

  it('is invalidated by a file the stage was given', async () => {
    await commit('src.ts', 'export const a = 2;\n');

    await strata.analyze({ root: changing });

    expect(ran()).toEqual(['typed', 'windowed']);
  });

  it('covers the history window for the stage that consumes it, and no other', async () => {
    await strata.analyze({ root: changing });
    expect(ran()).toEqual([]);

    // Same tree, a different window: only the stage that was handed the log
    // has anything to recompute.
    await strata.analyze({ root: changing, historyLimit: 1 });

    expect(ran()).toEqual(['windowed']);
  });
});
