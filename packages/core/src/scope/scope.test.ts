import type {
  CommitConventionPlugin,
  LanguagePlugin,
  RepoFile,
  StrataPlugin,
} from '@strata/sdk';
import { describe, expect, it } from 'vitest';
import type { LoadedPlugin } from '../registry.js';
import {
  chosenConvention,
  enabledPlugins,
  globMatcher,
  MissingPluginError,
  namedPlugins,
  scopedFiles,
  type LoadedConvention,
} from './index.js';

/**
 * A project's config decides what a run looks at and who takes part, so these
 * are the two questions the pipeline asks before it starts. The rules that
 * matter are the forgiving ones — an empty list restricts nothing, a bare
 * directory name means the tree under it, and a plugin list is an allow-list
 * rather than a wish — and the one that is not: a plugin named but not loaded
 * ends the run.
 */

function file(path: string): RepoFile {
  return { path, blob: path, read: async () => '' };
}

function paths(files: readonly RepoFile[]): string[] {
  return files.map((f) => f.path);
}

const TREE = [
  'src/a.ts',
  'src/nested/b.ts',
  'src/nested/b.test.ts',
  'a.test.ts',
  'docs/guide.md',
  'dist/bundle.js',
].map(file);

describe('globMatcher', () => {
  it('constrains nothing for a list with nothing in it', () => {
    expect(globMatcher([])).toBeNull();
    expect(globMatcher(null)).toBeNull();
    expect(globMatcher(undefined)).toBeNull();
    // A row someone left blank is not a pattern that matches everything.
    expect(globMatcher(['', '  ', '/'])).toBeNull();
  });

  it('keeps a single star inside one path segment', () => {
    const matches = globMatcher(['src/*.ts'])!;

    expect(matches('src/a.ts')).toBe(true);
    expect(matches('src/nested/b.ts')).toBe(false);
  });

  it('crosses segments with a double star, including none of them', () => {
    const matches = globMatcher(['**/*.test.ts'])!;

    expect(matches('src/nested/b.test.ts')).toBe(true);
    expect(matches('a.test.ts')).toBe(true);
    expect(matches('src/a.ts')).toBe(false);
  });

  it('matches one character per question mark, within a segment', () => {
    const matches = globMatcher(['src/?.ts'])!;

    expect(matches('src/a.ts')).toBe(true);
    expect(matches('src/ab.ts')).toBe(false);
  });

  it('takes a bare directory name for the tree under it', () => {
    const matches = globMatcher(['dist'])!;

    expect(matches('dist/bundle.js')).toBe(true);
    expect(matches('dist')).toBe(true);
    // A sibling that only starts with the same letters is not inside it.
    expect(matches('distribution/x.ts')).toBe(false);
  });

  it('reads a hand-typed pattern the way it was meant', () => {
    const matches = globMatcher(['./src/', '/docs'])!;

    expect(matches('src/a.ts')).toBe(true);
    expect(matches('docs/guide.md')).toBe(true);
  });

  it('treats regex punctuation as itself', () => {
    const matches = globMatcher(['a+b.ts'])!;

    expect(matches('a+b.ts')).toBe(true);
    expect(matches('aab.ts')).toBe(false);
    expect(matches('a+bXts')).toBe(false);
  });
});

describe('scopedFiles', () => {
  it('analyses the whole repository when nothing narrows it', () => {
    expect(paths(scopedFiles(TREE))).toEqual(paths(TREE));
    expect(paths(scopedFiles(TREE, { paths: [], ignore: [] }))).toEqual(
      paths(TREE),
    );
  });

  it('keeps only what the analyse paths name', () => {
    expect(paths(scopedFiles(TREE, { paths: ['src'] }))).toEqual([
      'src/a.ts',
      'src/nested/b.ts',
      'src/nested/b.test.ts',
    ]);
  });

  it('drops what the ignore globs name', () => {
    expect(paths(scopedFiles(TREE, { ignore: ['dist', '**/*.test.ts'] }))).toEqual(
      ['src/a.ts', 'src/nested/b.ts', 'docs/guide.md'],
    );
  });

  it('ignores within the analysed paths, not the other way round', () => {
    const scoped = scopedFiles(TREE, {
      paths: ['src'],
      ignore: ['**/*.test.ts'],
    });

    expect(paths(scoped)).toEqual(['src/a.ts', 'src/nested/b.ts']);
  });

  it('hands back a list of its own, so a caller cannot mutate the input', () => {
    const scoped = scopedFiles(TREE);
    scoped.pop();

    expect(TREE).toHaveLength(6);
  });
});

/**
 * Selecting plugins reads nothing but the manifest, so the export behind it is
 * a stand-in that would throw if anything here tried to run it.
 */
const STUB: LanguagePlugin = {
  kind: 'language',
  extensions: ['ts'],
  analyze: () => {
    throw new Error('choosing who runs never runs anyone');
  },
};

function loaded(id: string, plugin: StrataPlugin = STUB): LoadedPlugin {
  return {
    manifest: {
      id,
      name: id,
      kind: plugin.kind,
      version: '1.0.0',
      sdk: '0.1.0',
      main: './dist/index.js',
    },
    plugin,
    source: 'builtin',
    manifestPath: `/plugins/${id}/strata.plugin.json`,
  };
}

const LANGUAGES = { setting: 'languages', kind: 'language' } as const;

describe('enabledPlugins', () => {
  const all = [loaded('ts'), loaded('php')];

  it('runs every registered plugin when the project names none', () => {
    expect(enabledPlugins(all, undefined, LANGUAGES)).toEqual(all);
    expect(enabledPlugins(all, null, LANGUAGES)).toEqual(all);
  });

  it('runs exactly the ones a list names', () => {
    expect(enabledPlugins(all, ['php'], LANGUAGES)).toEqual([all[1]]);
  });

  it('runs none for an empty list, rather than all of them', () => {
    expect(enabledPlugins(all, [], LANGUAGES)).toEqual([]);
  });

  it('refuses an id no plugin answers to', () => {
    expect(() => enabledPlugins(all, ['ts', 'rust'], LANGUAGES)).toThrow(
      MissingPluginError,
    );
  });

  it('names the plugin, the setting that asked for it and the alternatives', () => {
    try {
      enabledPlugins(all, ['rust', 'go'], LANGUAGES);
      expect.unreachable('a named-but-missing plugin has to end the run');
    } catch (err) {
      const failure = err as MissingPluginError;
      expect(failure.missing).toEqual(['rust', 'go']);
      expect(failure.named).toEqual(LANGUAGES);
      expect(failure.message).toContain('"languages"');
      expect(failure.message).toContain('"rust", "go"');
      // What to install, or which of these the writer meant.
      expect(failure.message).toContain('Loaded language plugins: "ts", "php"');
    }
  });

  it('says so plainly when the workbench loaded none of that kind', () => {
    expect(() => enabledPlugins([], ['ts'], LANGUAGES)).toThrow(
      /No language plugin is loaded/,
    );
  });
});

function convention(id: string, name: string): LoadedConvention {
  const plugin: CommitConventionPlugin = {
    kind: 'commit-convention',
    convention: name,
    parse: () => ({
      type: null,
      scope: null,
      breaking: false,
      subject: '',
      tags: {},
      valid: false,
    }),
  };
  return { ...loaded(id, plugin), plugin };
}

describe('chosenConvention', () => {
  const all = [
    convention('commit-conventional', 'conventional'),
    convention('commit-gitmoji', 'gitmoji'),
  ];

  it('takes the first registered one when the project names none', () => {
    // What the kind has always done, and only for the conventions still of it:
    // one that has migrated is a stage, and its group refuses to be guessed at.
    expect(chosenConvention(all, undefined)?.convention).toBe('conventional');
    expect(chosenConvention(all, null)?.convention).toBe('conventional');
  });

  it('takes the one the project names, wherever it loaded', () => {
    expect(chosenConvention(all, 'commit-gitmoji')?.convention).toBe('gitmoji');
  });

  it('parses nothing here when the name belongs to a convention that migrated', () => {
    // A stage by that name may well be loaded; `requireLoaded` is what holds
    // the name to the workbench, and the scheduler is what runs it.
    expect(chosenConvention(all, 'strata-commit-conventional')).toBeUndefined();
  });

  it('has nothing to choose when no convention of the kind is registered', () => {
    expect(chosenConvention([], null)).toBeUndefined();
  });
});

/**
 * What an exclusive group is settled by. Only what configuration *named*: the
 * lists mean "every plugin" when they are empty, but a group means "nobody has
 * chosen yet", and the two must not be read as the same answer.
 */
describe('namedPlugins', () => {
  it('collects every id a setting named, whichever setting named it', () => {
    expect(
      namedPlugins({
        languages: ['lang-ts'],
        metrics: ['hotspots', 'coupling'],
        convention: 'commit-gitmoji',
      }),
    ).toEqual(['lang-ts', 'hotspots', 'coupling', 'commit-gitmoji']);
  });

  it('names nothing for a project that configured nothing', () => {
    expect(namedPlugins({})).toEqual([]);
    expect(
      namedPlugins({ languages: null, metrics: null, convention: null }),
    ).toEqual([]);
  });

  it('reads an empty allow-list as naming nothing, not as a choice', () => {
    // "Run no metrics" switches every metric off; it does not appoint one.
    expect(namedPlugins({ languages: [], metrics: [] })).toEqual([]);
  });
});
