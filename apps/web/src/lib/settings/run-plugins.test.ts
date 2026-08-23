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

  it('calls only the plugins the project enables', () => {
    const entries = runPlugins(
      [
        plugin(),
        plugin({ id: 'strata-language-php' }),
        plugin({ id: 'strata-git-hotspots', kind: 'git-metric' }),
        plugin({ id: 'strata-git-coupling', kind: 'git-metric' }),
      ],
      {
        languages: ['strata-language-typescript'],
        metrics: [],
        convention: null,
      },
    );

    expect(entries.map((entry) => entry.runs)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(entries[1]?.note).toContain('leaves it out');
  });

  it('parses with the convention the project chose, not the first loaded', () => {
    const entries = runPlugins(
      [
        plugin({ id: 'conventional', kind: 'commit-convention' }),
        plugin({ id: 'gitmoji', kind: 'commit-convention' }),
      ],
      { languages: null, metrics: null, convention: 'gitmoji' },
    );

    expect(entries[0]).toMatchObject({ id: 'conventional', runs: false });
    expect(entries[0]?.note).toContain('another convention');
    expect(entries[1]).toMatchObject({ id: 'gitmoji', runs: true });
  });

  it('stands every convention by when the chosen one is not installed', () => {
    const entries = runPlugins(
      [plugin({ id: 'conventional', kind: 'commit-convention' })],
      { languages: null, metrics: null, convention: 'jira' },
    );

    expect(entries[0]?.runs).toBe(false);
    // Not a fallback to the loaded one, and not a run that parses nothing —
    // there is no run. `missingPlugins()` is what says which name is at fault.
    expect(entries[0]?.note).toContain('no run starts');
  });

  it('leaves a stage on the setting that names what it produces', () => {
    // Hotspots is a stage now and is still what the `metrics` list means: a
    // project that switched it off stays switched off across the migration.
    const entries = runPlugins(
      [
        plugin({
          id: 'strata-git-hotspots',
          kind: 'stage',
          produces: 'metrics',
        }),
        plugin({
          id: 'strata-rules',
          kind: 'stage',
          produces: 'findings',
        }),
      ],
      { languages: null, metrics: [], convention: null },
    );

    expect(entries[0]).toMatchObject({ runs: false });
    expect(entries[0]?.note).toContain('leaves it out');
    // Nothing selects a findings stage yet, and unnamed means enabled.
    expect(entries[1]).toMatchObject({ runs: true, note: '' });
  });

  it('runs the one member of an exclusive group without being asked to', () => {
    // Installing a single convention is unambiguous on its own; an
    // unconfigured project should not have to say so before anything happens.
    const [entry] = runPlugins([
      plugin({
        id: 'strata-commit-conventional',
        kind: 'stage',
        produces: 'commits',
        exclusive: 'commit-convention',
      }),
    ]);

    expect(entry).toMatchObject({ runs: true, note: '' });
  });

  it('runs the member of a group the project named, and says who won', () => {
    const entries = runPlugins(
      [
        plugin({
          id: 'conventional',
          name: 'Conventional Commits',
          kind: 'stage',
          produces: 'commits',
          exclusive: 'commit-convention',
        }),
        plugin({
          id: 'gitmoji',
          name: 'Gitmoji',
          kind: 'stage',
          produces: 'commits',
          exclusive: 'commit-convention',
        }),
      ],
      { languages: null, metrics: null, convention: 'gitmoji' },
    );

    expect(entries[0]).toMatchObject({ runs: false });
    expect(entries[0]?.note).toContain('Gitmoji');
    expect(entries[1]).toMatchObject({ id: 'gitmoji', runs: true, note: '' });
  });

  it('says no run starts when a group of two is left open', () => {
    // The pipeline refuses it rather than picking one, so a confident list
    // here would be a promise about a run that is not going to happen.
    const entries = runPlugins([
      plugin({
        id: 'conventional',
        kind: 'stage',
        produces: 'commits',
        exclusive: 'commit-convention',
      }),
      plugin({
        id: 'gitmoji',
        kind: 'stage',
        produces: 'commits',
        exclusive: 'commit-convention',
      }),
    ]);

    expect(entries.map((entry) => entry.runs)).toEqual([false, false]);
    expect(entries[0]?.note).toContain('no run starts');
  });

  it('lets an allow-list settle a group, as the pipeline does', () => {
    // Two rule engines in one group, one of them switched off: what is left is
    // a group of one, and nobody has to choose between them.
    const entries = runPlugins(
      [
        plugin({
          id: 'rules-a',
          kind: 'stage',
          produces: 'metrics',
          exclusive: 'rules',
        }),
        plugin({
          id: 'rules-b',
          kind: 'stage',
          produces: 'metrics',
          exclusive: 'rules',
        }),
      ],
      { languages: null, metrics: ['rules-a'], convention: null },
    );

    expect(entries[0]).toMatchObject({ id: 'rules-a', runs: true, note: '' });
    expect(entries[1]?.note).toContain('leaves it out');
  });

  it('stands a convention of the older kind by when a stage parses instead', () => {
    const entries = runPlugins([
      plugin({
        id: 'strata-commit-conventional',
        kind: 'stage',
        produces: 'commits',
        exclusive: 'commit-convention',
      }),
      plugin({ id: 'legacy-gitmoji', kind: 'commit-convention' }),
    ]);

    expect(entries[0]?.runs).toBe(true);
    expect(entries[1]?.runs).toBe(false);
    expect(entries[1]?.note).toContain('convention stage');
  });

  it('stands a plugin of a kind this build has no step for by', () => {
    const [entry] = runPlugins([
      plugin({ id: 'strata-oracle', kind: 'oracle' as LoadedPluginInfo['kind'] }),
    ]);

    expect(entry?.runs).toBe(false);
    expect(entry?.note).toContain('no step for it');
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
