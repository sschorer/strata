import { describe, expect, it } from 'vitest';
import type { LoadedPluginInfo } from '$lib/api';
import { missingPlugins } from './missing-plugins';
import type { RunPluginConfig } from './run-plugins';

/**
 * The core refuses a run whose configuration names a plugin nobody loaded, so
 * this is the screen's way of saying so before the button is pressed. What it
 * has to get right is the negative case: a project that names nothing names
 * nothing missing, and a warning over an ordinary project would train the
 * reader to ignore the one that matters.
 */

function plugin(overrides: Partial<LoadedPluginInfo> = {}): LoadedPluginInfo {
  return {
    id: 'strata-language-typescript',
    name: 'TypeScript',
    kind: 'language',
    version: '0.1.0',
    sdk: '0',
    main: 'dist/index.js',
    source: 'builtin',
    ...overrides,
  };
}

const LOADED = [
  plugin(),
  plugin({ id: 'strata-git-hotspots', kind: 'git-metric' }),
  plugin({ id: 'commit-conventional', kind: 'commit-convention' }),
];

function config(overrides: Partial<RunPluginConfig> = {}): RunPluginConfig {
  return { languages: null, metrics: null, convention: null, ...overrides };
}

describe('missingPlugins', () => {
  it('finds nothing missing in a project that names nothing', () => {
    expect(missingPlugins(LOADED, config())).toEqual([]);
  });

  it('finds nothing missing while the config is still on the way', () => {
    expect(missingPlugins(LOADED, null)).toEqual([]);
  });

  it('finds nothing missing in a project that names what is loaded', () => {
    const named = config({
      languages: ['strata-language-typescript'],
      metrics: [],
      convention: 'commit-conventional',
    });

    expect(missingPlugins(LOADED, named)).toEqual([]);
  });

  it('names the setting, the kind and the ids that answer to nothing', () => {
    const named = config({
      languages: ['strata-language-typescript', 'strata-language-rust'],
    });

    expect(missingPlugins(LOADED, named)).toEqual([
      {
        setting: 'languages',
        kind: 'language',
        ids: ['strata-language-rust'],
      },
    ]);
  });

  it('checks each setting against its own kind', () => {
    // A language plugin's id in the metrics list is not a metric plugin.
    const named = config({ metrics: ['strata-language-typescript'] });

    expect(missingPlugins(LOADED, named)).toEqual([
      {
        setting: 'metrics',
        kind: 'git-metric',
        ids: ['strata-language-typescript'],
      },
    ]);
  });

  it('reports the chosen convention, which is one id rather than a list', () => {
    const named = config({ convention: 'commit-gitmoji' });

    expect(missingPlugins(LOADED, named)).toEqual([
      {
        setting: 'convention',
        kind: 'commit-convention',
        ids: ['commit-gitmoji'],
      },
    ]);
  });

  it('reports every setting that is wrong, not the first one', () => {
    const named = config({
      languages: ['strata-language-rust'],
      metrics: ['coupling'],
      convention: 'commit-gitmoji',
    });

    expect(missingPlugins(LOADED, named).map((m) => m.setting)).toEqual([
      'languages',
      'metrics',
      'convention',
    ]);
  });

  it('names everything a workbench with nothing loaded is missing', () => {
    const named = config({ convention: 'commit-conventional' });

    expect(missingPlugins([], named)).toEqual([
      {
        setting: 'convention',
        kind: 'commit-convention',
        ids: ['commit-conventional'],
      },
    ]);
  });
});
