import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyAppPatch,
  DEFAULT_APP_SETTINGS,
  InvalidSettingsError,
  withAppDefaults,
  type StoredAppSettings,
} from './index.js';

/**
 * App settings are stored sparsely and filled out on read, so the two halves
 * have to agree: what a patch keeps, what it replaces, and what it refuses to
 * store at all — a provider card posted from an empty form must not become a
 * provider Strata would try to launch.
 */

describe('withAppDefaults', () => {
  it('fills empty settings out to the pre-configuration behaviour', () => {
    expect(withAppDefaults({})).toEqual({
      appearance: { theme: 'system', density: 'balanced' },
      engine: { pluginsDir: null, thirdPartyPlugins: true, cache: true },
      gates: { failOnNewCycles: false, hotspotRegression: null },
      ai: { healthCheckInterval: 0, providers: [] },
    });
  });

  it('defaults the rest of a section somebody half-configured', () => {
    expect(withAppDefaults({ appearance: { density: 'airy' } })).toMatchObject({
      appearance: { theme: 'system', density: 'airy' },
    });
  });

  it('copies out, so a caller cannot mutate the defaults', () => {
    withAppDefaults({}).ai.providers.push({
      id: 'codex',
      name: 'Codex',
      enabled: true,
      accent: null,
      binary: null,
      home: null,
      shadowHome: null,
      args: [],
      env: {},
      models: [],
    });

    expect(DEFAULT_APP_SETTINGS.ai.providers).toEqual([]);
  });

  it('copies a stored provider, so neither can be mutated through the other', () => {
    const stored: StoredAppSettings = applyAppPatch(
      {},
      { ai: { providers: [{ id: 'codex', name: 'Codex', models: ['o4'] }] } },
    );

    withAppDefaults(stored).ai.providers[0]?.models.push('gpt-5');

    expect(withAppDefaults(stored).ai.providers[0]?.models).toEqual(['o4']);
  });
});

describe('applyAppPatch', () => {
  const stored: StoredAppSettings = {
    appearance: { theme: 'dark' },
    engine: { cache: false },
  };

  it('merges section by section and leaves the rest alone', () => {
    expect(applyAppPatch(stored, { gates: { failOnNewCycles: true } })).toEqual({
      appearance: { theme: 'dark' },
      engine: { cache: false },
      gates: { failOnNewCycles: true },
    });
  });

  it('merges field by field inside a section', () => {
    expect(
      applyAppPatch(stored, { appearance: { density: 'dense' } }).appearance,
    ).toEqual({ theme: 'dark', density: 'dense' });
  });

  it('makes the plugins directory absolute, and takes null for "follow the environment"', () => {
    expect(
      applyAppPatch({}, { engine: { pluginsDir: 'plugins/local' } }).engine,
    ).toEqual({ pluginsDir: resolve('plugins/local') });
    expect(
      applyAppPatch({ engine: { pluginsDir: '/opt/plugins' } }, {
        engine: { pluginsDir: null },
      }).engine,
    ).toEqual({ pluginsDir: null });
  });

  it('keeps a provider, defaulting a new one to disabled and empty', () => {
    const patched = applyAppPatch(
      {},
      { ai: { providers: [{ id: 'codex', name: ' Codex ' }] } },
    );

    expect(patched.ai?.providers).toEqual([
      {
        id: 'codex',
        name: 'Codex',
        enabled: false,
        accent: null,
        binary: null,
        home: null,
        shadowHome: null,
        args: [],
        env: {},
        models: [],
      },
    ]);
  });

  it('replaces the provider list whole rather than adding to it', () => {
    const first = applyAppPatch(
      {},
      { ai: { providers: [{ id: 'codex', name: 'Codex' }] } },
    );

    const second = applyAppPatch(first, {
      ai: { providers: [{ id: 'claude', name: 'Claude' }] },
    });

    expect(second.ai?.providers?.map((p) => p.id)).toEqual(['claude']);
  });

  it('drops blank rows, keeps repeated launch args and collapses repeated models', () => {
    const patched = applyAppPatch(
      {},
      {
        ai: {
          providers: [
            {
              id: 'codex',
              name: 'Codex',
              args: ['--verbose', ' ', '--verbose'],
              models: [' o4 ', '', 'o4'],
            },
          ],
        },
      },
    );

    expect(patched.ai?.providers?.[0]).toMatchObject({
      args: ['--verbose', '--verbose'],
      models: ['o4'],
    });
  });

  it('keeps an environment value exactly as written', () => {
    const patched = applyAppPatch(
      {},
      {
        ai: {
          providers: [
            { id: 'codex', name: 'Codex', env: { ' AGENT_HOME ': '/opt/a b/' } },
          ],
        },
      },
    );

    expect(patched.ai?.providers?.[0]?.env).toEqual({ AGENT_HOME: '/opt/a b/' });
  });

  it('refuses a value that cannot mean anything', () => {
    expect(() =>
      applyAppPatch({}, { appearance: { theme: 'midnight' as never } }),
    ).toThrow(InvalidSettingsError);
    expect(() =>
      applyAppPatch({}, { appearance: { density: 'roomy' as never } }),
    ).toThrow(InvalidSettingsError);
    expect(() => applyAppPatch({}, { engine: { pluginsDir: '  ' } })).toThrow(
      InvalidSettingsError,
    );
    expect(() =>
      applyAppPatch({}, { gates: { hotspotRegression: -1 } }),
    ).toThrow(InvalidSettingsError);
    expect(() => applyAppPatch({}, { ai: { healthCheckInterval: 2.5 } })).toThrow(
      InvalidSettingsError,
    );
    expect(() => applyAppPatch({}, { ai: { healthCheckInterval: -5 } })).toThrow(
      InvalidSettingsError,
    );
  });

  it('refuses a provider nobody could launch or address', () => {
    const refuse = (provider: unknown) =>
      expect(() =>
        applyAppPatch({}, { ai: { providers: [provider as never] } }),
      ).toThrow(InvalidSettingsError);

    refuse({ id: 'Codex Agent', name: 'Codex' });
    refuse({ id: 'codex', name: '  ' });
    refuse({ id: 'codex', name: 'Codex', binary: '  ' });
    refuse({ id: 'codex', name: 'Codex', accent: 'blue' });
    refuse({ id: 'codex', name: 'Codex', env: { 'not a name': 'x' } });
  });

  it('refuses two providers with the same id', () => {
    expect(() =>
      applyAppPatch(
        {},
        {
          ai: {
            providers: [
              { id: 'codex', name: 'Codex' },
              { id: 'codex', name: 'Codex, again' },
            ],
          },
        },
      ),
    ).toThrow(InvalidSettingsError);
  });

  it('does not touch what it was given', () => {
    const before = structuredClone(stored);

    applyAppPatch(stored, { appearance: { theme: 'light' } });

    expect(stored).toEqual(before);
  });
});
