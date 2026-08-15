import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  memoryProjectStore,
  PluginRegistry,
  type ProjectStore,
  type Strata,
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
import { projectConfigRoute } from './project-config.js';

/**
 * The *Project settings* screens read and write through here. A PATCH merges,
 * so what a screen leaves out survives; what it names has to exist, so a
 * plugin toggle cannot store an id that will never run.
 */

const LANGUAGE_ID = 'test-language';

let projects: ProjectStore;
let app: FastifyInstance;
let id: string;
let pluginDir: string;
let registry: PluginRegistry;

/** One real registered plugin, so "known" and "unknown" are both testable. */
beforeAll(async () => {
  pluginDir = mkdtempSync(join(tmpdir(), 'strata-config-plugin-'));
  mkdirSync(join(pluginDir, 'dist'), { recursive: true });
  writeFileSync(
    join(pluginDir, 'dist/index.mjs'),
    "export default { kind: 'language', extensions: ['ts'], analyze: async () => ({}) };\n",
  );
  writeFileSync(
    join(pluginDir, 'strata.plugin.json'),
    JSON.stringify({
      id: LANGUAGE_ID,
      name: 'Test language',
      kind: 'language',
      version: '1.0.0',
      sdk: '0.1.0',
      main: './dist/index.mjs',
    }),
  );

  registry = new PluginRegistry({
    debug() {},
    info() {},
    warn() {},
    error() {},
  });
  await registry.loadFrom(join(pluginDir, 'strata.plugin.json'));
}, 30_000);

afterAll(() => {
  rmSync(pluginDir, { recursive: true, force: true });
});

beforeEach(() => {
  projects = memoryProjectStore();
  id = projects.add({ name: 'Strata', root: '/repos/strata' }).id;
  app = Fastify();
  projectConfigRoute(app, { projects, registry, strata: {} as Strata });
});

afterEach(async () => {
  await app.close();
});

function get(project = id) {
  return app.inject({ url: `/projects/${project}/config` });
}

async function patch(body: unknown, project = id) {
  return await app.inject({
    method: 'PATCH',
    url: `/projects/${project}/config`,
    payload: body as Record<string, unknown>,
  });
}

describe('GET /projects/:id/config', () => {
  it('answers with the defaults before anything is configured', async () => {
    const response = await get();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      rev: 'HEAD',
      historyLimit: null,
      ignore: [],
      paths: [],
      languages: null,
      metrics: null,
      convention: null,
      rules: [],
    });
  });

  it('answers 404 for a project nobody registered', async () => {
    expect((await get('ghost')).statusCode).toBe(404);
  });
});

describe('PATCH /projects/:id/config', () => {
  it('merges into what is stored and answers with the whole config', async () => {
    await patch({ rev: 'main', historyLimit: 500 });

    const response = await patch({ ignore: ['**/dist/**'] });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      rev: 'main',
      historyLimit: 500,
      ignore: ['**/dist/**'],
    });
    expect((await get()).json()).toMatchObject({ rev: 'main' });
  });

  it('takes null for "no cap" and "every registered plugin"', async () => {
    await patch({ historyLimit: 500 });

    const response = await patch({ historyLimit: null, languages: null });

    expect(response.json()).toMatchObject({
      historyLimit: null,
      languages: null,
    });
  });

  it('stores architecture rules, defaulting a new one to report-only', async () => {
    const response = await patch({
      rules: [{ from: 'src/ui/**', to: 'src/db/**' }],
    });

    expect(response.json().rules).toEqual([
      { from: 'src/ui/**', to: 'src/db/**', enforced: false },
    ]);
  });

  it('stores a plugin selection this workbench can actually run', async () => {
    const response = await patch({ languages: [LANGUAGE_ID] });

    expect(response.statusCode).toBe(200);
    expect(response.json().languages).toEqual([LANGUAGE_ID]);
  });

  it('refuses a plugin id this workbench has not loaded', async () => {
    const response = await patch({ languages: ['strata-language-cobol'] });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('strata-language-cobol');
    // Nothing of the patch is stored when part of it is refused.
    expect((await get()).json().languages).toBeNull();
  });

  it('refuses a metric or convention it does not know either', async () => {
    expect((await patch({ metrics: [LANGUAGE_ID] })).statusCode).toBe(400);
    expect((await patch({ convention: 'gitmoji' })).statusCode).toBe(400);
  });

  it('rejects a value that cannot mean anything', async () => {
    expect((await patch({ historyLimit: 0 })).statusCode).toBe(400);
    expect((await patch({ rev: '' })).statusCode).toBe(400);
    expect((await patch({ rules: [{ from: 'src/**' }] })).statusCode).toBe(400);
    expect((await patch({ nope: true })).statusCode).toBe(400);
    // An empty patch is a client bug, not a way to read the config back.
    expect((await patch({})).statusCode).toBe(400);
  });

  it('answers 404 for a project nobody registered', async () => {
    expect((await patch({ rev: 'main' }, 'ghost')).statusCode).toBe(404);
  });
});
