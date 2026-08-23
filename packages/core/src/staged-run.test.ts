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
  /** Every file a stage had to look at itself, rather than read from cache. */
  var __strataFileScans: string[] | undefined;
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

/**
 * A language module: a dependency graph over whatever files it was given, and
 * what it learned about them on the way. It returns no summary, so the run's is
 * the one the core derives for a module that did not count its own.
 */
const GRAPH = (id: string) => `export default {
  kind: 'stage',
  async run(ctx) {
    (globalThis.__strataStageRuns ??= []).push('${id}');
    return {
      graph: {
        nodes: ctx.files.map((f) => ({ id: f.path, label: f.path, kind: 'file' })),
        edges: [],
        cycles: [],
      },
      deadCode: ctx.files.map((f) => ({ path: f.path, reason: 'unreachable-file' })),
      metrics: ctx.files.map((f) => ({ path: f.path, loc: 1 })),
    };
  },
};
`;

/**
 * A stage that does its per-file work through `ctx.cache`, recording what it
 * actually had to look at — the half of the incremental path a whole-stage
 * cache miss does not spare a language module.
 */
const SCANNER = (id: string) => `export default {
  kind: 'stage',
  async run(ctx) {
    (globalThis.__strataStageRuns ??= []).push('${id}');
    const nodes = [];
    for (const file of ctx.files) {
      const loc = await ctx.cache.file(file, async (f) => {
        (globalThis.__strataFileScans ??= []).push(f.path);
        return (await f.read()).split('\\n').length;
      });
      nodes.push({ id: file.path, label: file.path, kind: 'file', meta: { loc } });
    }
    return {
      graph: { nodes, edges: [], cycles: [] },
      deadCode: [],
      metrics: nodes.map((n) => ({ path: n.id, loc: n.meta.loc })),
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

/** A stage that throws, the way any stage anyone adds eventually will. */
const THROWS = (id: string, message: string) => `export default {
  kind: 'stage',
  async run() {
    (globalThis.__strataStageRuns ??= []).push('${id}');
    throw new Error('${message}');
  },
};
`;

/**
 * A commit convention: the run's history window, read into a parsed log that
 * stamps the convention's own name as the type, so a report says who parsed it.
 */
const CONVENTION = (id: string) => `export default {
  kind: 'stage',
  async run(ctx) {
    (globalThis.__strataStageRuns ??= []).push('${id}');
    return ctx.history.map((commit) => ({
      type: '${id}',
      scope: null,
      breaking: false,
      subject: commit.message,
      tags: {},
      valid: true,
    }));
  },
};
`;

/**
 * The commit fold, as far as this suite cares: it counts the window it was
 * handed and the log whoever produced one parsed, and says which producers it
 * saw. The real fold ships as its own plugin; what is being tested here is that
 * the core wires the two together and carries the result.
 */
const FOLD = `export default {
  kind: 'stage',
  async run(ctx) {
    (globalThis.__strataStageRuns ??= []).push('strata-commit-fold');
    const producers = Object.keys(ctx.inputs.commits).sort();
    const parsed = Object.values(ctx.inputs.commits)[0] ?? [];
    return {
      total: ctx.history.length,
      valid: parsed.length,
      invalid: 0,
      validRate: parsed.length > 0 ? 1 : 0,
      breaking: 0,
      types: parsed.map((commit) => ({
        name: commit.type,
        count: 1,
        share: 1,
        breaking: 0,
      })),
      scopes: [],
      weeks: [],
      producers,
    };
  },
};
`;

/** What a fixture's manifest declares about its stage. */
interface Declarations {
  produces: OutputType;
  consumes?: OutputType[];
  filter?: StageFilter;
  exclusive?: string;
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
    // Two steps before the stages, the history read, and the three stages —
    // nothing else, because no convention of the old kind parses here.
    expect(steps.at(-1)).toMatchObject({ completed: 6, total: 6 });
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
 * A repository has one commit convention, and "96% conforming" only means
 * something relative to one — so the conventions declare a shared **exclusive
 * group**, configuration names the active member, and the rest are not in the
 * run at all. The graph downstream then sees exactly one parsed log.
 */
describe('an exclusive group', () => {
  /** A workbench with `ids` conventions loaded, all in the same group. */
  async function conventions(...ids: string[]): Promise<PluginRegistry> {
    const registry = new PluginRegistry();
    for (const id of ids) {
      await install(
        registry,
        id,
        { produces: 'commits', consumes: ['commits'], exclusive: 'commit-convention' },
        CONVENTION(id),
      );
    }
    return registry;
  }

  it('runs the member the configuration named, and leaves the rest out', async () => {
    const registry = await conventions('conventional', 'gitmoji');
    const strata = new Strata(registry, { cache: false });

    try {
      const report = await strata.analyze({ root: repo, convention: 'gitmoji' });

      expect(globalThis.__strataStageRuns).toEqual(['gitmoji']);
      // Not skipped — out of the run entirely, as an allow-list leaves a stage.
      expect(report.stages.conventional).toBeUndefined();
      expect(report.provenance.map((entry) => entry.id)).toEqual(['gitmoji']);
      expect(report.commits.map((commit) => commit.type)).toEqual(['gitmoji']);
    } finally {
      strata.close();
    }
  });

  it('needs no choice while the group has one member', async () => {
    const registry = await conventions('conventional');
    const strata = new Strata(registry, { cache: false });

    try {
      // Installing a single convention is unambiguous on its own; an
      // unconfigured workbench that did nothing with it would be useless.
      const report = await strata.analyze({ root: repo });

      expect(report.commits.map((commit) => commit.type)).toEqual([
        'conventional',
      ]);
    } finally {
      strata.close();
    }
  });

  it('fails the run when two are loaded and nothing chose between them', async () => {
    const registry = await conventions('conventional', 'gitmoji');
    const strata = new Strata(registry, { cache: false });

    try {
      // Picking one would report the history as conforming to a convention
      // nobody asked for, which no reader can tell from a history that does.
      await expect(strata.analyze({ root: repo })).rejects.toThrow(
        /exclusive group "commit-convention"/,
      );
      expect(globalThis.__strataStageRuns).toEqual([]);
    } finally {
      strata.close();
    }
  });

  it('still fails a run naming a convention nobody loaded', async () => {
    const registry = await conventions('conventional');
    const strata = new Strata(registry, { cache: false });

    try {
      await expect(
        strata.analyze({ root: repo, convention: 'gitmoji' }),
      ).rejects.toThrow(/"convention" names commit-convention plugin "gitmoji"/);
    } finally {
      strata.close();
    }
  });
});

/**
 * A stage that throws costs its own branch and no more.
 *
 * The whole point of an open pipeline is that anyone can add a stage, and once
 * anyone can, one of them dividing by zero must not discard twenty minutes of
 * analysis that had nothing to do with it. What comes back is a **partial
 * run** — still a run, still recorded, and honest about the hole in it
 * (`docs/adr/0015`).
 *
 * The workbench under test:
 *
 *   breaks ──▶ reads-graph ──▶ reads-aggregate      (produces graph, throws)
 *   unrelated                                       (produces metrics)
 *   nothing-to-do                                   (filter matches no file)
 */
describe('a stage that throws', () => {
  let strata: Strata;
  let report: AnalysisReport;

  beforeAll(async () => {
    const registry = new PluginRegistry();
    await install(
      registry,
      'breaks',
      { produces: 'graph', filter: { extensions: ['ts'] } },
      THROWS('breaks', 'cannot parse src/a.ts'),
    );
    await install(
      registry,
      'reads-graph',
      { produces: 'findings', consumes: ['graph'] },
      WITNESS('reads-graph'),
    );
    await install(
      registry,
      'reads-aggregate',
      { produces: 'aggregate', consumes: ['findings'] },
      WITNESS('reads-aggregate'),
    );
    await install(
      registry,
      'unrelated',
      { produces: 'metrics', filter: { extensions: ['ts'] } },
      SERIES('unrelated'),
    );
    await install(
      registry,
      'nothing-to-do',
      { produces: 'commits', filter: { extensions: ['py'] } },
      WITNESS('nothing-to-do'),
    );
    strata = new Strata(registry, { cache: false });
  });

  afterAll(() => strata.close());

  beforeEach(async () => {
    report = await strata.analyze({ root: repo });
  });

  it('is recorded as failed, with what it threw', () => {
    expect(report.stages.breaks).toEqual({
      status: 'failed',
      type: 'graph',
      reason: 'cannot parse src/a.ts',
    });
    // Not an empty graph: what it would have said is not knowable, and a
    // reader must not be able to mistake the one for the other.
    expect(report.stages.breaks).not.toHaveProperty('output');
  });

  it('takes its dependents out of the run, naming what failed them', () => {
    expect(report.stages['reads-graph']).toEqual({
      status: 'skipped',
      type: 'findings',
      reason: expect.stringContaining('"breaks" failed'),
      blockedBy: 'breaks',
    });
    expect(globalThis.__strataStageRuns).not.toContain('reads-graph');
  });

  it('names the stage that failed, not the nearest casualty', () => {
    // `reads-aggregate` consumes findings, which `reads-graph` never produced.
    // Following the chain back is the reader's job to do once, here, rather
    // than every time somebody reads a report.
    expect(report.stages['reads-aggregate']).toMatchObject({
      status: 'skipped',
      blockedBy: 'breaks',
    });
  });

  it('leaves every branch the failure never reached alone', () => {
    expect(globalThis.__strataStageRuns).toContain('unrelated');
    expect(report.stages.unrelated).toMatchObject({
      status: 'ok',
      type: 'metrics',
      output: { id: 'unrelated' },
    });
    // And it still reaches the field a metric series has always reached.
    expect(report.metrics.map((series) => series.id)).toEqual(['unrelated']);
  });

  it('is distinguishable from a stage that simply had nothing to do', () => {
    // Both are `skipped`, and only one of them is somebody's bug: an empty
    // branch has no stage to name, and says why in its own words.
    expect(report.stages['nothing-to-do']).toMatchObject({
      status: 'skipped',
      reason: expect.stringContaining('matched no file'),
    });
    expect(report.stages['nothing-to-do']).not.toHaveProperty('blockedBy');
  });

  it('makes the run partial rather than failed', () => {
    expect(report.run.status).toBe('partial');
  });

  it('records how each stage ended, in the order they were ordered', () => {
    // Everything that waits on nothing first, in declaration order, then the
    // stages that wait — the order is the plan's, whatever became of them.
    expect(report.provenance).toEqual([
      { id: 'breaks', version: '1.0.0', status: 'failed' },
      { id: 'unrelated', version: '1.0.0', status: 'ok' },
      { id: 'nothing-to-do', version: '1.0.0', status: 'skipped' },
      { id: 'reads-graph', version: '1.0.0', status: 'skipped' },
      { id: 'reads-aggregate', version: '1.0.0', status: 'skipped' },
    ]);
  });

  it('is not still counting the stages it took out as steps to wait for', async () => {
    const steps: AnalysisProgress[] = [];
    await strata.analyze({ root: repo }, (progress) => steps.push(progress));

    const staged = steps.filter((step) => step.stage === 'stage');
    expect(staged.map((step) => step.detail)).toEqual(['breaks', 'unrelated']);
    // The plan counted the two the failure went on to cut, because nothing
    // knew it was coming; the finished step reports what the run actually did
    // rather than leaving a reader at 4 of 6.
    expect(steps.at(-1)).toMatchObject({ stage: 'finished', completed: 5, total: 5 });
  });
});

/**
 * A run that kept nothing is not a run that partly worked. There is no half of
 * it to read, so it is a **failed** run — the one thing a stage failure can
 * still cost the whole job (`docs/adr/0015`).
 */
describe('a run in which every stage failed', () => {
  it('is a failed run, not a partial one', async () => {
    const registry = new PluginRegistry();
    await install(
      registry,
      'breaks',
      { produces: 'graph', filter: { extensions: ['ts'] } },
      THROWS('breaks', 'out of memory'),
    );
    await install(
      registry,
      'also-breaks',
      { produces: 'metrics', filter: { extensions: ['ts'] } },
      THROWS('also-breaks', 'no such column'),
    );
    const strata = new Strata(registry, { cache: false });

    try {
      const report = await strata.analyze({ root: repo });

      expect(report.run.status).toBe('failed');
      // Both of them ran and both of them threw: a failure is not contagious
      // between stages that have nothing to do with each other.
      expect(globalThis.__strataStageRuns).toEqual(['breaks', 'also-breaks']);
      expect(report.stages['also-breaks']).toMatchObject({
        status: 'failed',
        reason: 'no such column',
      });
    } finally {
      strata.close();
    }
  });
});

/**
 * The point of caching per stage: a failure costs the next run only the work
 * that failed. A stage that threw stored nothing, so it is asked again; the one
 * beside it stored its result, so it is not.
 */
describe('a retry after a stage failed', () => {
  let changing: string;
  let cacheDir: string;
  let strata: Strata;

  beforeAll(async () => {
    changing = mkdtempSync(join(tmpdir(), 'strata-staged-retry-repo-'));
    cacheDir = mkdtempSync(join(tmpdir(), 'strata-staged-retry-cache-'));
    await exec('git', ['init', '-q', '-b', 'main'], { cwd: changing });
    writeFileSync(join(changing, 'src.ts'), 'export const a = 1;\n');
    await exec('git', ['add', '-A'], { cwd: changing });
    await exec('git', ['commit', '-q', '-m', 'feat: initial'], {
      cwd: changing,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Strata Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Strata Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    });

    const registry = new PluginRegistry();
    await install(
      registry,
      'works',
      { produces: 'metrics', filter: { extensions: ['ts'] } },
      SERIES('works'),
    );
    await install(
      registry,
      'breaks',
      { produces: 'graph', filter: { extensions: ['ts'] } },
      THROWS('breaks', 'still broken'),
    );
    strata = new Strata(registry, { cache: { dir: cacheDir } });
  }, 30_000);

  afterAll(() => {
    strata.close();
    for (const dir of [changing, cacheDir]) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('re-runs what failed and nothing else', async () => {
    await strata.analyze({ root: changing });
    expect(globalThis.__strataStageRuns).toEqual(['works', 'breaks']);

    globalThis.__strataStageRuns = [];
    const second = await strata.analyze({ root: changing });

    // Nothing was written back for the stage that threw, so a stored answer
    // cannot make its failure permanent.
    expect(globalThis.__strataStageRuns).toEqual(['breaks']);
    expect(second.cache.runHits).toBe(1);
    expect(second.stages.works).toMatchObject({ status: 'ok' });
    expect(second.stages.breaks).toMatchObject({ status: 'failed' });
  });
});

/**
 * The commit fold is the first stage that consumes another stage's output
 * rather than the repository — the pattern every later consumer follows. It
 * asks for a parsed log by output type and is handed whatever produced one.
 */
describe('a stage that consumes another stage', () => {
  let strata: Strata;

  beforeAll(async () => {
    const registry = new PluginRegistry();
    // The fold is loaded first, so an order that came out right came from the
    // declarations rather than from who was installed first.
    await install(
      registry,
      'strata-commit-fold',
      { produces: 'aggregate', consumes: ['commits'] },
      FOLD,
    );
    await install(
      registry,
      'gitmoji',
      { produces: 'commits', consumes: ['commits'], exclusive: 'commit-convention' },
      CONVENTION('gitmoji'),
    );
    strata = new Strata(registry, { cache: false });
  });

  afterAll(() => strata.close());

  it('runs after the convention and is handed its log, keyed by producer', async () => {
    const report = await strata.analyze({ root: repo });

    expect(globalThis.__strataStageRuns).toEqual([
      'gitmoji',
      'strata-commit-fold',
    ]);
    expect(witnessed(report, 'strata-commit-fold')).toMatchObject({
      producers: ['gitmoji'],
      total: 1,
      valid: 1,
    });
  });

  it('still fills in the field the commit analytics have always reached', async () => {
    const report = await strata.analyze({ root: repo });

    // What the *Commit analytics* screen reads. The fold is a stage now and
    // the core counts nothing itself, but nothing downstream has moved yet.
    expect(report.commitAnalytics).toMatchObject({
      total: 1,
      types: [{ name: 'gitmoji' }],
    });
  });

  it('reports zeroes for a workbench with no fold installed', async () => {
    const registry = new PluginRegistry();
    await install(
      registry,
      'gitmoji',
      { produces: 'commits', consumes: ['commits'] },
      CONVENTION('gitmoji'),
    );
    const unfolded = new Strata(registry, { cache: false });

    try {
      const report = await unfolded.analyze({ root: repo });

      // Honest rather than helpful: the log was parsed, and nothing counted it.
      expect(report.commits).toHaveLength(1);
      expect(report.commitAnalytics.total).toBe(0);
    } finally {
      unfolded.close();
    }
  });
});

/**
 * A language module is a stage producing a `graph`, and a graph is the whole of
 * what the module knows about the files it was handed — the graph itself, the
 * dead code it found and what it measured per file. All of it has to arrive in
 * one stage entry, and all of it has to keep reaching the fields the screens
 * still read.
 */
describe('what a language module reaches', () => {
  let strata: Strata;

  beforeAll(async () => {
    const registry = new PluginRegistry();
    await install(
      registry,
      'lang-ts',
      { produces: 'graph', version: '0.7.0', filter: { extensions: ['ts'] } },
      GRAPH('lang-ts'),
    );
    strata = new Strata(registry, { cache: false });
  });

  afterAll(() => strata.close());

  it('carries its graph, its dead code and its metrics in one stage entry', async () => {
    const report = await strata.analyze({ root: repo });
    const entry = report.stages['lang-ts'];

    if (entry?.status !== 'ok') throw new Error('the stage did not run');
    expect(entry.type).toBe('graph');
    expect(entry.output).toMatchObject({
      graph: { nodes: [{ id: 'src/a.ts' }, { id: 'src/b.ts' }] },
      deadCode: [
        { path: 'src/a.ts', reason: 'unreachable-file' },
        { path: 'src/b.ts', reason: 'unreachable-file' },
      ],
      metrics: [
        { path: 'src/a.ts', loc: 1 },
        { path: 'src/b.ts', loc: 1 },
      ],
    });
  });

  it('still fills in the field a language result has always reached', async () => {
    const report = await strata.analyze({ root: repo });

    // Keyed by manifest id rather than by the extensions it claimed
    // (`docs/adr/0011`), and folded into the cross-language graph as ever.
    expect(Object.keys(report.languages)).toEqual(['lang-ts']);
    expect(report.dependencies.nodes.map((node) => node.id)).toEqual([
      'src/a.ts',
      'src/b.ts',
    ]);
  });

  it('is summarised by the core when the module counted nothing itself', async () => {
    const report = await strata.analyze({ root: repo });

    expect(report.languages['lang-ts']?.summary).toMatchObject({
      nodes: 2,
      edges: 0,
      cycles: 0,
    });
  });

  it('leaves the module out of a run its allow-list left out', async () => {
    const report = await strata.analyze({ root: repo, languages: [] });

    expect(report.stages['lang-ts']).toBeUndefined();
    expect(report.languages).toEqual({});
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

/**
 * The cache *underneath* a stage: `ctx.cache.file` is keyed by blob, so a stage
 * the run key sent back to work still only does the work the change made
 * necessary. A language module parses every file it is handed, and one edit
 * must not cost a whole repository's parse.
 */
describe('the per-file cache a stage is scoped', () => {
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

  /** The files scanned since the last call. */
  function scanned(): string[] {
    const seen = globalThis.__strataFileScans ?? [];
    globalThis.__strataFileScans = [];
    return seen.sort();
  }

  beforeAll(async () => {
    changing = mkdtempSync(join(tmpdir(), 'strata-staged-blob-repo-'));
    cacheDir = mkdtempSync(join(tmpdir(), 'strata-staged-blob-cache-'));
    await exec('git', ['init', '-q', '-b', 'main'], { cwd: changing });
    writeFileSync(join(changing, 'a.ts'), 'export const a = 1;\n');
    await commit('b.ts', 'export const b = 2;\n');

    const registry = new PluginRegistry();
    await install(
      registry,
      'scanner',
      { produces: 'graph', filter: { extensions: ['ts'] } },
      SCANNER('scanner'),
    );
    strata = new Strata(registry, { cache: { dir: cacheDir } });
  }, 30_000);

  afterAll(() => {
    strata.close();
    for (const dir of [changing, cacheDir]) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scans every file on a cold cache', async () => {
    await strata.analyze({ root: changing });

    expect(scanned()).toEqual(['a.ts', 'b.ts']);
  });

  it('re-scans the file that changed, and no other', async () => {
    await commit('b.ts', 'export const b = 2;\nexport const c = 3;\n');

    const report = await strata.analyze({ root: changing });

    expect(scanned()).toEqual(['b.ts']);
    expect(report.cache).toMatchObject({ hits: 1, misses: 1 });
    expect(report.languages.scanner?.metrics).toEqual([
      { path: 'a.ts', loc: 2 },
      { path: 'b.ts', loc: 3 },
    ]);
  });
});
