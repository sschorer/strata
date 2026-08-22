import Fastify, { type FastifyInstance } from 'fastify';
import type {
  AnalysisQueue,
  LoadedPlugin,
  PluginRegistry,
  ProjectStore,
  SettingsStore,
} from '@strata/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pluginsRoute } from './plugins.js';

/**
 * What the workbench loaded, as the plugins screen reads it — and, since a
 * plugin declares its stage in its manifest, the only way to see what the
 * pipeline is without running it.
 */

const HOTSPOTS = {
  manifest: {
    id: 'strata-git-hotspots',
    name: 'Hotspots',
    kind: 'git-metric',
    version: '0.1.0',
    sdk: '0.2.0',
    main: './dist/index.js',
    consumes: ['commits'],
    produces: 'metrics',
    filter: { extensions: ['ts'] },
    exclusive: 'hotspots',
  },
  source: 'builtin',
  manifestPath: '/app/plugins/git-hotspots/strata.plugin.json',
} as unknown as LoadedPlugin;

let app: FastifyInstance;

beforeEach(() => {
  app = Fastify();
  pluginsRoute(app, {
    registry: {
      all: () => [HOTSPOTS],
      failures: () => [],
    } as unknown as PluginRegistry,
    settings: {} as SettingsStore,
    projects: {} as ProjectStore,
    analyses: {} as AnalysisQueue,
    pluginsDir: '/app/.strata/plugins',
  });
});

afterEach(async () => {
  await app.close();
});

describe('GET /plugins', () => {
  it('reports every declaration a plugin made about its stage', async () => {
    const response = await app.inject({ url: '/plugins' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      directory: '/app/.strata/plugins',
      plugins: [{ ...HOTSPOTS.manifest, source: 'builtin' }],
      failures: [],
    });
  });
});
