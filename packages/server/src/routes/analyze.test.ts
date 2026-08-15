import Fastify, { type FastifyInstance } from 'fastify';
import {
  memoryProjectStore,
  memorySettingsStore,
  type AnalysisReport,
  type AnalyzeOptions,
  type PluginRegistry,
  type ProjectStore,
  type SettingsStore,
  type Strata,
} from '@strata/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { analyzeRoute } from './analyze.js';

/**
 * `/analyze` is a thin delegation, with one thing of its own: a run over a
 * registered root refreshes what the switcher shows about that project — and a
 * registry that will not take the update must not cost the caller the report.
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

const strata = {
  analyze: async (opts: AnalyzeOptions) => {
    requested = opts;
    return report;
  },
} as unknown as Strata;

let projects: ProjectStore;
let settings: SettingsStore;
let app: FastifyInstance;

function build(
  store: ProjectStore,
  appSettings: SettingsStore = settings,
): FastifyInstance {
  const instance = Fastify();
  analyzeRoute(instance, {
    strata,
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
  projects = memoryProjectStore();
  settings = memorySettingsStore();
  app = build(projects);
});

afterEach(async () => {
  await app.close();
});

describe('POST /analyze', () => {
  it('records the run against the project registered for that root', async () => {
    const project = projects.add({ name: 'Strata', root: '/repos/strata' });

    const response = await analyze('/repos/strata');

    expect(response.json()).toEqual(report);
    expect(projects.get(project.id)?.lastAnalysis).toEqual({
      rev: report.rev,
      ...report.run,
    });
  });

  it('runs a registered project the way its settings say', async () => {
    const { id } = projects.add({ name: 'Strata', root: '/repos/strata' });
    projects.setConfig(id, { rev: 'develop', historyLimit: 500 });

    await analyze('/repos/strata');

    expect(requested).toMatchObject({ rev: 'develop', historyLimit: 500 });
  });

  it('lets the request override what the settings say', async () => {
    const { id } = projects.add({ name: 'Strata', root: '/repos/strata' });
    projects.setConfig(id, { rev: 'develop', historyLimit: 500 });

    await analyze('/repos/strata', { rev: 'v1.0.0', historyLimit: 10 });

    expect(requested).toMatchObject({ rev: 'v1.0.0', historyLimit: 10 });
  });

  it('leaves the core its own defaults for an unconfigured project', async () => {
    projects.add({ name: 'Strata', root: '/repos/strata' });

    await analyze('/repos/strata');

    // `HEAD` and no cap are what the core does anyway; a null limit must not
    // reach it as a number.
    expect(requested).toMatchObject({ rev: 'HEAD', historyLimit: undefined });
  });

  it('runs with the cache the app settings leave switched on', async () => {
    await analyze('/repos/strata');
    expect(requested).toMatchObject({ cache: true });

    settings.patch({ engine: { cache: false } });
    await analyze('/repos/strata');

    expect(requested).toMatchObject({ cache: false });
  });

  it('lets a request ask for a cold run whatever the settings say', async () => {
    await analyze('/repos/strata', { cache: false });
    expect(requested).toMatchObject({ cache: false });

    settings.patch({ engine: { cache: false } });
    await analyze('/repos/strata', { cache: true });

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

    const response = await analyze('/repos/strata');

    expect(response.statusCode).toBe(200);
    // No preference reaches the core, so it keeps its own default.
    expect(requested).toMatchObject({ cache: undefined });
  });

  it('analyses a root nobody registered without recording anything', async () => {
    const response = await analyze('/repos/unregistered');

    expect(response.statusCode).toBe(200);
    expect(projects.list()).toEqual([]);
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

    const response = await analyze('/repos/strata');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(report);
  });
});
