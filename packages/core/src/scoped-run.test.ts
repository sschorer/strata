import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PluginRegistry } from './registry.js';
import { Strata } from './strata.js';

const exec = promisify(execFile);

/**
 * A project's configuration is only worth storing if the pipeline obeys it, so
 * this drives a real repository with real plugins loaded and asks what actually
 * ran: which files reached a language module, which plugins were called at all,
 * and which convention parsed the history.
 *
 * The repository:
 *
 *   src/a.ts            in scope
 *   src/a.test.ts       in scope, but what an ignore glob is for
 *   docs/note.md        outside `src`
 *
 * Two language plugins claim `ts`, one claims `md`, and two conventions parse
 * the same history into recognisably different answers.
 */

const LANGUAGE = (id: string, ext: string) => `export default {
  kind: 'language',
  extensions: ['${ext}'],
  async analyze(ctx) {
    return {
      graph: {
        nodes: ctx.files.map((f) => ({ id: f.path, label: f.path, kind: 'file' })),
        edges: [],
        cycles: [],
      },
      deadCode: [],
      metrics: [{ id: '${id}', label: '${id}', points: [] }],
    };
  },
};
`;

const METRIC = (id: string) => `export default {
  kind: 'git-metric',
  id: '${id}',
  async compute(ctx) {
    return { id: '${id}', label: '${id}', points: [] };
  },
};
`;

/** Each convention stamps its own name as the type, so the report says who ran. */
const CONVENTION = (name: string) => `export default {
  kind: 'commit-convention',
  convention: '${name}',
  parse: (commit) => ({
    type: '${name}',
    scope: null,
    breaking: false,
    subject: commit.message.trim(),
    tags: {},
    valid: true,
  }),
};
`;

let repo: string;
let plugins: string;
let strata: Strata;

async function git(args: string[]): Promise<void> {
  await exec('git', args, {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Strata Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Strata Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

/** Write a plugin out as a directory the registry can load. */
async function install(
  registry: PluginRegistry,
  id: string,
  kind: string,
  source: string,
): Promise<void> {
  const dir = join(plugins, id);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist/index.mjs'), source);
  writeFileSync(
    join(dir, 'strata.plugin.json'),
    JSON.stringify({
      id,
      name: id,
      kind,
      version: '1.0.0',
      sdk: '0.1.0',
      main: './dist/index.mjs',
    }),
  );
  await registry.loadFrom(join(dir, 'strata.plugin.json'));
}

/** Which files one language plugin was handed, from the graph it returned. */
function analysed(
  languages: Record<string, { graph: { nodes: { id: string }[] } }>,
  ext: string,
): string[] {
  return (languages[ext]?.graph.nodes ?? []).map((n) => n.id).sort();
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-scoped-repo-'));
  plugins = mkdtempSync(join(tmpdir(), 'strata-scoped-plugins-'));

  await exec('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'docs'));
  writeFileSync(join(repo, 'src/a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'src/a.test.ts'), 'export const t = 1;\n');
  writeFileSync(join(repo, 'docs/note.md'), '# note\n');
  await git(['add', '-A']);
  await git(['commit', '-m', 'feat: initial']);

  const registry = new PluginRegistry();
  await install(registry, 'lang-ts', 'language', LANGUAGE('lang-ts', 'ts'));
  await install(registry, 'lang-md', 'language', LANGUAGE('lang-md', 'md'));
  await install(registry, 'metric-a', 'git-metric', METRIC('metric-a'));
  await install(registry, 'metric-b', 'git-metric', METRIC('metric-b'));
  await install(
    registry,
    'convention-first',
    'commit-convention',
    CONVENTION('first'),
  );
  await install(
    registry,
    'convention-second',
    'commit-convention',
    CONVENTION('second'),
  );

  // No cache: every run here is about what the pipeline chose to do, and a
  // stored result would answer for a scope the next run no longer has.
  strata = new Strata(registry, { cache: false });
}, 30_000);

afterAll(() => {
  strata.close();
  for (const dir of [repo, plugins]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('a run without a configuration', () => {
  it('analyses the whole repository with every plugin', async () => {
    const report = await strata.analyze({ root: repo });

    expect(report.run.files).toBe(3);
    expect(analysed(report.languages, 'ts')).toEqual([
      'src/a.test.ts',
      'src/a.ts',
    ]);
    expect(analysed(report.languages, 'md')).toEqual(['docs/note.md']);
    expect(report.metrics.map((m) => m.id)).toEqual(['metric-a', 'metric-b']);
    expect(report.commits[0]?.type).toBe('first');
  });
});

describe('scope', () => {
  it('routes only the analysed paths to the plugins', async () => {
    const report = await strata.analyze({ root: repo, paths: ['src'] });

    expect(analysed(report.languages, 'ts')).toEqual([
      'src/a.test.ts',
      'src/a.ts',
    ]);
    // Nothing matched the markdown plugin's extension, so it never ran.
    expect(report.languages.md).toBeUndefined();
  });

  it('takes the ignored globs back out', async () => {
    const report = await strata.analyze({
      root: repo,
      paths: ['src'],
      ignore: ['**/*.test.ts'],
    });

    expect(analysed(report.languages, 'ts')).toEqual(['src/a.ts']);
  });

  it('reports the file count the run actually analysed', async () => {
    const report = await strata.analyze({ root: repo, ignore: ['docs'] });

    expect(report.run.files).toBe(2);
  });
});

describe('enabled plugins', () => {
  it('calls only the language plugins the project allows', async () => {
    const report = await strata.analyze({ root: repo, languages: ['lang-md'] });

    expect(Object.keys(report.languages)).toEqual(['md']);
  });

  it('calls only the git metrics the project allows', async () => {
    const report = await strata.analyze({ root: repo, metrics: ['metric-b'] });

    expect(report.metrics.map((m) => m.id)).toEqual(['metric-b']);
  });

  it('runs none of a kind for an empty allow-list', async () => {
    const report = await strata.analyze({
      root: repo,
      languages: [],
      metrics: [],
    });

    expect(report.languages).toEqual({});
    expect(report.metrics).toEqual([]);
  });
});

describe('commit convention', () => {
  it('parses with the convention the project chose, not the first loaded', async () => {
    const report = await strata.analyze({
      root: repo,
      convention: 'convention-second',
    });

    expect(report.commits.map((c) => c.type)).toEqual(['second']);
    expect(report.commitAnalytics.types).toEqual([
      { name: 'second', count: 1, share: 1, breaking: 0 },
    ]);
  });

  it('parses nothing when the chosen convention is not loaded', async () => {
    const report = await strata.analyze({ root: repo, convention: 'gone' });

    expect(report.commits).toEqual([]);
    // An unparsed window still reports its activity and judges no conformance.
    expect(report.commitAnalytics.total).toBe(1);
    expect(report.commitAnalytics.valid).toBe(0);
    expect(report.commitAnalytics.invalid).toBe(0);
  });
});
