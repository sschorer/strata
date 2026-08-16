import { describe, expect, it } from 'vitest';
import type { LoadedPluginInfo } from '$lib/api';
import { runPlugins } from './run-plugins';

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

describe('runPlugins', () => {
  it('runs every language module and every git metric', () => {
    const entries = runPlugins([
      plugin(),
      plugin({ id: 'strata-git-hotspots', kind: 'git-metric' }),
    ]);

    expect(entries.map((entry) => entry.runs)).toEqual([true, true]);
    expect(entries.every((entry) => entry.note === '')).toBe(true);
  });

  it('keeps the order the workbench loaded them in', () => {
    const entries = runPlugins([
      plugin({ id: 'strata-git-coupling', kind: 'git-metric' }),
      plugin(),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual([
      'strata-git-coupling',
      'strata-language-typescript',
    ]);
  });

  it('lets the first convention parse and stands the rest by', () => {
    const entries = runPlugins([
      plugin({ id: 'conventional', kind: 'commit-convention' }),
      plugin({ id: 'gitmoji', kind: 'commit-convention' }),
    ]);

    expect(entries[0]).toMatchObject({ id: 'conventional', runs: true });
    expect(entries[1]?.runs).toBe(false);
    expect(entries[1]?.note).toContain('another convention');
  });

  it('leaves an AI provider out of a run', () => {
    const [entry] = runPlugins([plugin({ id: 'codex', kind: 'ai-provider' })]);

    expect(entry?.runs).toBe(false);
    expect(entry?.note).toContain('no part of a run');
  });

  it('carries what a chip prints, source included', () => {
    const [entry] = runPlugins([plugin({ source: 'user' })]);

    expect(entry).toMatchObject({
      id: 'strata-language-typescript',
      name: 'TypeScript',
      kind: 'language',
      source: 'user',
    });
  });
});
