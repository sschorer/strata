import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  AnalysisQueue,
  memoryProjectStore,
  memorySettingsStore,
  type AnalysisReport,
  type AnalysisRunner,
  type AnalyzeOptions,
  type PluginRegistry,
  type ProjectStore,
  type SettingsStore,
} from '@strata/core';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { analyzeRoute } from './analyze.js';

/**
 * `/analyze` is a thin delegation onto the analysis queue, with three things of
 * its own: the root it is handed is confined to `$STRATA_ROOTS` before anything
 * reads it; a run over a registered root refreshes what the switcher shows
 * about that project — where a registry that will not take the update must not
 * cost the caller the report; and the caller chooses whether to wait for the
 * report or to take the job and collect it later.
 *
 * The roots are read per request, so the test points them at a tree of its own:
 *
 *   <base>/            ← the root
 *     strata/          the registered repository
 *     unregistered/
 *     link -> strata   a symlink that stays inside
 *   <outside>/         a directory the allow-list never names
 */

const report = {
  rev: '4c1249e',
  run: {
    branch: 'main',
    files: 42,
    durationMs: 1820,
    finishedAt: '2026-08-15T10:00:00.000Z',
  },
  languages: {},
  metrics: [],
  commits: [],
  commitAnalytics: {
    total: 0,
    valid: 0,
    invalid: 0,
    validRate: 0,
    breaking: 0,
    types: [],
    scopes: [],
    weeks: [],
  },
  cache: {
    enabled: false,
    hits: 0,
    misses: 0,
    runHits: 0,
    runMisses: 0,
    writes: 0,
  },
} satisfies AnalysisReport;

/** What the route asked the core for, so the defaults can be asserted. */
let requested: AnalyzeOptions | undefined;
/** Set to fail the next run, so the endpoint's error path can be reached. */
let failure = '';
/** Set to hold a run open, so a second request meets one already in flight. */
let gate: Promise<void> | null = null;

/** A runner in place of the analysis thread; the queue in front of it is real. */
const runner: AnalysisRunner = {
  analyze: async (opts) => {
    requested = opts;
    if (gate) await gate;
    if (failure) throw new Error(failure);
    return report;
  },
  clearCache: async () => undefined,
  close: async () => undefined,
};

let analyses: AnalysisQueue;
let base: string;
let repo: string;
let unregistered: string;
let outside: string;
let projects: ProjectStore;
let settings: SettingsStore;
let app: FastifyInstance;

beforeAll(async () => {
  base = await realpath(mkdtempSync(join(tmpdir(), 'strata-analyze-api-')));
  repo = join(base, 'strata');
  unregistered = join(base, 'unregistered');
  mkdirSync(repo);
  mkdirSync(unregistered);
  symlinkSync(repo, join(base, 'link'));
  outside = await realpath(mkdtempSync(join(tmpdir(), 'strata-outside-api-')));
  process.env.STRATA_ROOTS = base;
});

afterAll(() => {
  delete process.env.STRATA_ROOTS;
  for (const dir of [base, outside]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function build(
  store: ProjectStore,
  appSettings: SettingsStore = settings,
): FastifyInstance {
  const instance = Fastify();
  analyzeRoute(instance, {
    analyses,
    projects: store,
    settings: appSettings,
    registry: {} as PluginRegistry,
    pluginsDir: '/app/.strata/plugins',
  });
  return instance;
}

async function analyze(root: string, body: Record<string, unknown> = {}) {
  return await app.inject({
    method: 'POST',
    url: '/analyze',
    payload: { root, ...body },
  });
}

beforeEach(() => {
  requested = undefined;
  failure = '';
  gate = null;
  analyses = new AnalysisQueue(runner);
  projects = memoryProjectStore();
  settings = memorySettingsStore();
  app = build(projects);
});

afterEach(async () => {
  await app.close();
  await analyses.close();
});

describe('POST /analyze', () => {
  it('records the run against the project registered for that root', async () => {
    const project = projects.add({ name: 'Strata', root: repo });

    const response = await analyze(repo);

    expect(response.json()).toEqual(report);
    expect(projects.get(project.id)?.lastAnalysis).toEqual({
      rev: report.rev,
      ...report.run,
    });
  });

  it('runs a registered project the way its settings say', async () => {
    const { id } = projects.add({ name: 'Strata', root: repo });
    projects.setConfig(id, { rev: 'develop', historyLimit: 500 });

    await analyze(repo);

    expect(requested).toMatchObject({ rev: 'develop', historyLimit: 500 });
  });

  it('hands the core the project scope, its plugins and its convention', async () => {
    const { id } = projects.add({ name: 'Strata', root: repo });
    projects.setConfig(id, {
      paths: ['src'],
      ignore: ['**/*.test.ts'],
      languages: ['language-typescript'],
      metrics: [],
      convention: 'commit-gitmoji',
    });

    await analyze(repo);

    expect(requested).toMatchObject({
      paths: ['src'],
      ignore: ['**/*.test.ts'],
      languages: ['language-typescript'],
      metrics: [],
      convention: 'commit-gitmoji',
    });
  });

  it('lets the request override what the settings say', async () => {
    const { id } = projects.add({ name: 'Strata', root: repo });
    projects.setConfig(id, { rev: 'develop', historyLimit: 500 });

    await analyze(repo, { rev: 'v1.0.0', historyLimit: 10 });

    expect(requested).toMatchObject({ rev: 'v1.0.0', historyLimit: 10 });
  });

  it('leaves the core its own defaults for an unconfigured project', async () => {
    projects.add({ name: 'Strata', root: repo });

    await analyze(repo);

    // `HEAD`, no cap, the whole repository and every plugin are what the core
    // does anyway; a null limit must not reach it as a number.
    expect(requested).toMatchObject({
      rev: 'HEAD',
      historyLimit: undefined,
      paths: [],
      ignore: [],
      languages: null,
      metrics: null,
      convention: null,
    });
  });

  it('leaves the core its own defaults for a root nobody registered', async () => {
    await analyze(unregistered);

    // No project, so nothing narrows the run: the whole repository, every
    // plugin, and the convention the registry loaded first.
    expect(requested).toMatchObject({
      paths: undefined,
      ignore: undefined,
      languages: undefined,
      metrics: undefined,
      convention: undefined,
    });
  });

  it('runs with the cache the app settings leave switched on', async () => {
    await analyze(repo);
    expect(requested).toMatchObject({ cache: true });

    settings.patch({ engine: { cache: false } });
    await analyze(repo);

    expect(requested).toMatchObject({ cache: false });
  });

  it('lets a request ask for a cold run whatever the settings say', async () => {
    await analyze(repo, { cache: false });
    expect(requested).toMatchObject({ cache: false });

    settings.patch({ engine: { cache: false } });
    await analyze(repo, { cache: true });

    expect(requested).toMatchObject({ cache: true });
  });

  it('still returns the report when the settings cannot be read', async () => {
    const broken: SettingsStore = {
      ...settings,
      get: () => {
        throw new Error('database is locked');
      },
    };
    await app.close();
    app = build(projects, broken);

    const response = await analyze(repo);

    expect(response.statusCode).toBe(200);
    // No preference reaches the core, so it keeps its own default.
    expect(requested).toMatchObject({ cache: undefined });
  });

  it('analyses a root nobody registered without recording anything', async () => {
    const response = await analyze(unregistered);

    expect(response.statusCode).toBe(200);
    expect(projects.list()).toEqual([]);
  });

  it('refuses a root outside the allowed ones, without reading it', async () => {
    const response = await analyze(outside);

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain('may reach');
    expect(requested).toBeUndefined();
  });

  it('answers 404 for a root inside them that is not there', async () => {
    const response = await analyze(join(base, 'ghost'));

    expect(response.statusCode).toBe(404);
    expect(requested).toBeUndefined();
  });

  it('analyses the path as it is on disk, not as it was written', async () => {
    const project = projects.add({ name: 'Strata', root: repo });

    // A symlink inside the roots: what runs is what was checked, so the
    // registered project is found through it.
    const response = await analyze(join(base, 'link'));

    expect(response.statusCode).toBe(200);
    expect(requested).toMatchObject({ root: repo });
    expect(projects.get(project.id)?.lastAnalysis).not.toBeNull();
  });

  it('hands back the job instead of the report when asked not to wait', async () => {
    const response = await analyze(repo, { wait: false });

    expect(response.statusCode).toBe(202);
    const { job } = response.json() as { job: { id: string; root: string } };
    expect(job).toMatchObject({ root: repo, state: 'queued', report: null });

    // Nobody is waiting, and the run still happens.
    const finished = await analyses.settled(job.id);
    expect(finished?.state).toBe('succeeded');
    expect(finished?.report).toEqual(report);
  });

  it('records a run the caller never waited for', async () => {
    const project = projects.add({ name: 'Strata', root: repo });

    const response = await analyze(repo, { wait: false });
    const { job } = response.json() as { job: { id: string } };
    await analyses.settled(job.id);
    // The registry is written by the same continuation that settles the job.
    await Promise.resolve();

    expect(projects.get(project.id)?.lastAnalysis).toMatchObject({
      rev: report.rev,
    });
  });

  it('joins a run already in flight rather than queueing a second', async () => {
    let release = (): void => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = await analyze(repo, { wait: false });
    const second = await analyze(repo, { wait: false });
    release();

    const id = (body: typeof first) =>
      (body.json() as { job: { id: string } }).job.id;
    expect(id(second)).toBe(id(first));
    expect(analyses.list()).toHaveLength(1);
    await analyses.settled(id(first));
  });

  it('answers 500 with the reason when the run fails', async () => {
    failure = 'not a git repository';

    const response = await analyze(repo);

    expect(response.statusCode).toBe(500);
    expect(response.json().message).toBe('not a git repository');
  });

  it('still answers 202 for a run that goes on to fail', async () => {
    failure = 'not a git repository';

    const response = await analyze(repo, { wait: false });

    // Whether the run works out is the job's news, not the submission's.
    expect(response.statusCode).toBe(202);
    const { job } = response.json() as { job: { id: string } };
    expect((await analyses.settled(job.id))?.error).toBe('not a git repository');
  });

  it('still returns the report when the registry refuses the update', async () => {
    const broken: ProjectStore = {
      ...projects,
      findByRoot: () => {
        throw new Error('database is locked');
      },
    };
    await app.close();
    app = build(broken);

    const response = await analyze(repo);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(report);
  });
});
