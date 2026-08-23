import type { RawCommit, RepoFile, StageContext } from '@strata/sdk';
import { describe, expect, it, vi } from 'vitest';
import plugin from './index.js';

/** Commits as git would print them for `--name-only --pretty=format:%x1e`. */
function gitLog(commits: string[][]): string {
  return commits.map((files) => `\x1e\n\n${files.join('\n')}\n`).join('');
}

/**
 * A stage context as the core builds one: the files the manifest's filter
 * matched, the outputs of the types it consumes (none produce a parsed log
 * here), and the run's history window, which it gets because it consumes
 * `commits`.
 */
function context(
  paths: string[],
  log: string,
  history: readonly RawCommit[],
): StageContext {
  return {
    root: '/repo',
    rev: 'deadbeef',
    files: paths.map((path) => ({ path }) as RepoFile),
    git: vi.fn(async () => log),
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    cache: { file: (_file, compute) => compute(_file) },
    inputs: {
      graph: {},
      metrics: {},
      findings: {},
      commits: {},
      aggregate: {},
    },
    history,
  };
}

const history = (n: number): RawCommit[] =>
  Array.from({ length: n }, (_, i) => ({
    sha: `sha${i}`,
    author: 'Ada',
    authorEmail: 'ada@example.com',
    date: '2026-01-01T00:00:00Z',
    message: 'chore: work',
  }));

describe('change-coupling stage', () => {
  it('reports the pairs that keep changing together', async () => {
    const commits = [
      ['src/route.ts', 'src/client.ts'],
      ['src/route.ts', 'src/client.ts'],
      ['src/route.ts', 'src/client.ts'],
      ['README.md'],
    ];
    const ctx = context(
      ['src/route.ts', 'src/client.ts', 'README.md'],
      gitLog(commits),
      history(commits.length),
    );

    const series = await plugin.run(ctx);

    expect(series.id).toBe('change-coupling');
    expect(series.unit).toBe('%');
    expect(series.points).toHaveLength(1);
    expect(series.points[0]).toMatchObject({
      subject: 'src/client.ts ↔ src/route.ts',
      value: 100,
      meta: { sharedChanges: 3 },
    });

    // The window is exactly the history the core handed us.
    expect(ctx.git).toHaveBeenCalledWith(
      expect.arrayContaining(['log', '--name-only', '-n', '4', 'sha0']),
    );
  });

  it('returns an empty series for an empty history', async () => {
    const ctx = context(['a.ts'], '', []);
    const series = await plugin.run(ctx);

    expect(series.points).toEqual([]);
    expect(ctx.git).not.toHaveBeenCalled();
  });
});
