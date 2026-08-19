import Fastify, { type FastifyInstance } from 'fastify';
import {
  type AnalysisQueue,
  memoryProjectStore,
  memorySettingsStore,
  type PluginRegistry,
  type SettingsStore,
} from '@strata/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { settingsRoute } from './settings.js';

/**
 * The app-wide *Settings* screens read and write through here. A PATCH merges
 * two levels deep, so a screen that edits one section leaves the others alone —
 * and a value the workbench could not act on is refused rather than stored.
 */

let settings: SettingsStore;
let app: FastifyInstance;

beforeEach(() => {
  settings = memorySettingsStore();
  app = Fastify();
  settingsRoute(app, {
    settings,
    projects: memoryProjectStore(),
    registry: {} as PluginRegistry,
    analyses: {} as AnalysisQueue,
    pluginsDir: '/app/.strata/plugins',
  });
});

afterEach(async () => {
  await app.close();
});

function get() {
  return app.inject({ url: '/settings' });
}

async function patch(body: unknown) {
  return await app.inject({
    method: 'PATCH',
    url: '/settings',
    payload: body as Record<string, unknown>,
  });
}

describe('GET /settings', () => {
  it('answers with the defaults before anything is configured', async () => {
    const response = await get();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      appearance: { theme: 'system', density: 'balanced' },
      engine: { pluginsDir: null, thirdPartyPlugins: true, cache: true },
      gates: { failOnNewCycles: false, hotspotRegression: null },
      ai: { healthCheckInterval: 0, providers: [] },
    });
  });
});

describe('PATCH /settings', () => {
  it('merges into what is stored and answers with all of it', async () => {
    await patch({ appearance: { theme: 'light' } });

    const response = await patch({ appearance: { density: 'dense' } });

    expect(response.statusCode).toBe(200);
    expect(response.json().appearance).toEqual({
      theme: 'light',
      density: 'dense',
    });
    expect((await get()).json().appearance.theme).toBe('light');
  });

  it('leaves the sections a screen did not touch alone', async () => {
    await patch({ engine: { cache: false } });

    const response = await patch({ gates: { hotspotRegression: 15 } });

    expect(response.json()).toMatchObject({
      engine: { cache: false },
      gates: { hotspotRegression: 15, failOnNewCycles: false },
      appearance: { theme: 'system' },
    });
  });

  it('stores a plugins directory as an absolute path, and null to follow the environment', async () => {
    const set = await patch({ engine: { pluginsDir: '/opt/strata/plugins' } });
    expect(set.json().engine.pluginsDir).toBe('/opt/strata/plugins');

    const cleared = await patch({ engine: { pluginsDir: null } });
    expect(cleared.json().engine.pluginsDir).toBeNull();
  });

  it('stores an AI provider, defaulting a new one to disabled', async () => {
    const response = await patch({
      ai: {
        providers: [
          {
            id: 'codex',
            name: 'Codex',
            binary: '/usr/local/bin/codex',
            shadowHome: '/home/dev/.codex-work',
            args: ['--json'],
            env: { CODEX_PROFILE: 'work' },
            models: ['o4-mini'],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().ai.providers).toEqual([
      {
        id: 'codex',
        name: 'Codex',
        enabled: false,
        accent: null,
        binary: '/usr/local/bin/codex',
        home: null,
        shadowHome: '/home/dev/.codex-work',
        args: ['--json'],
        env: { CODEX_PROFILE: 'work' },
        models: ['o4-mini'],
      },
    ]);
  });

  it('replaces the provider list whole, the way the screen renders it', async () => {
    await patch({ ai: { providers: [{ id: 'codex', name: 'Codex' }] } });

    const response = await patch({
      ai: { providers: [{ id: 'claude', name: 'Claude' }] },
    });

    const ids = response.json().ai.providers.map((p: { id: string }) => p.id);
    expect(ids).toEqual(['claude']);
  });

  it('rejects a value that cannot mean anything', async () => {
    expect((await patch({ appearance: { theme: 'midnight' } })).statusCode).toBe(
      400,
    );
    expect((await patch({ appearance: { density: 'roomy' } })).statusCode).toBe(
      400,
    );
    expect((await patch({ gates: { hotspotRegression: -1 } })).statusCode).toBe(
      400,
    );
    expect((await patch({ ai: { healthCheckInterval: -1 } })).statusCode).toBe(
      400,
    );
    expect((await patch({ engine: { cache: 'off' } })).statusCode).toBe(400);
    expect((await patch({ nope: true })).statusCode).toBe(400);
  });

  it('rejects a provider nobody could launch or address', async () => {
    const refused = async (provider: unknown) => {
      const response = await patch({ ai: { providers: [provider] } });
      return response.statusCode;
    };

    expect(await refused({ name: 'Codex' })).toBe(400);
    expect(await refused({ id: 'Codex Agent', name: 'Codex' })).toBe(400);
    expect(await refused({ id: 'codex', name: '' })).toBe(400);
    expect(await refused({ id: 'codex', name: 'Codex', accent: 'blue' })).toBe(
      400,
    );
    expect(
      await refused({ id: 'codex', name: 'Codex', env: { 'a b': 'x' } }),
    ).toBe(400);

    // Nothing of a refused patch is stored.
    expect((await get()).json().ai.providers).toEqual([]);
  });

  it('rejects two providers sharing an id, which the schema cannot see', async () => {
    const response = await patch({
      ai: {
        providers: [
          { id: 'codex', name: 'Codex' },
          { id: 'codex', name: 'Codex, again' },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('codex');
  });

  it('rejects a patch that changes nothing', async () => {
    expect((await patch({})).statusCode).toBe(400);
    // Naming a screen without naming a setting on it is the same client bug.
    expect((await patch({ appearance: {} })).statusCode).toBe(400);
  });
});
