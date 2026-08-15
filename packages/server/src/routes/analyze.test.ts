import Fastify, { type FastifyInstance } from 'fastify';
import {
  memoryProjectStore,
  type AnalysisReport,
  type PluginRegistry,
  type ProjectStore,
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

const strata = { analyze: async () => report } as unknown as Strata;

let projects: ProjectStore;
let app: FastifyInstance;

function build(store: ProjectStore): FastifyInstance {
  const instance = Fastify();
  analyzeRoute(instance, {
    strata,
    projects: store,
    registry: {} as PluginRegistry,
  });
  return instance;
}

async function analyze(root: string) {
  return await app.inject({
    method: 'POST',
    url: '/analyze',
    payload: { root },
  });
}

beforeEach(() => {
  projects = memoryProjectStore();
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
