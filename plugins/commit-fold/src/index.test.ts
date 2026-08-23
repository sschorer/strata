import type { ParsedCommit, RawCommit, StageContext } from '@strata/sdk';
import { describe, expect, it, vi } from 'vitest';
import plugin from './index.js';
import type { CommitAnalytics } from './types.js';

/**
 * A stage context as the core builds one: no files, because the manifest
 * declares no filter and the tree is none of this stage's business; the run's
 * history window and every parsed log produced upstream, because it declares
 * that it consumes `commits`.
 */
function context(
  history: readonly RawCommit[],
  commits: Record<string, ParsedCommit[]> = {},
): StageContext {
  return {
    root: '/repo',
    rev: 'deadbeef',
    files: [],
    git: vi.fn(async () => ''),
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    cache: { file: (file, compute) => compute(file) },
    inputs: {
      graph: {},
      metrics: {},
      findings: {},
      commits,
      aggregate: {},
    },
    history,
  };
}

function raw(date: string): RawCommit {
  return {
    sha: date,
    author: 'Ada',
    authorEmail: 'ada@example.com',
    date,
    message: 'feat: something',
  };
}

function parsed(p: Partial<ParsedCommit> = {}): ParsedCommit {
  return {
    type: 'feat',
    scope: null,
    breaking: false,
    subject: 'something',
    tags: {},
    valid: true,
    ...p,
  };
}

const fold = (ctx: StageContext): Promise<CommitAnalytics> =>
  plugin.run(ctx) as Promise<CommitAnalytics>;

describe('commit-fold stage', () => {
  const window = [
    raw('2024-03-06T12:00:00+00:00'),
    raw('2024-03-07T12:00:00+00:00'),
    raw('2024-03-12T12:00:00+00:00'),
  ];

  it('counts the log a convention parsed against the window git reported', async () => {
    const analytics = await fold(
      context(window, {
        'strata-commit-conventional': [
          parsed({ type: 'feat', scope: 'core' }),
          parsed({ type: 'fix', scope: 'core', breaking: true }),
          parsed({ type: null, scope: null, valid: false }),
        ],
      }),
    );

    expect(analytics.total).toBe(3);
    expect(analytics.valid).toBe(2);
    expect(analytics.breaking).toBe(1);
    expect(analytics.types.map((b) => b.name)).toEqual(['feat', 'fix', null]);
    expect(analytics.scopes.map((b) => b.name)).toEqual(['core', null]);
    expect(analytics.weeks).toEqual([
      { week: '2024-03-04', commits: 2 },
      { week: '2024-03-11', commits: 1 },
    ]);
  });

  it('takes the log from whoever produced one, never by name', async () => {
    // A convention this stage has never heard of, keyed by its own plugin id.
    const analytics = await fold(
      context(window, { 'some-gitmoji-convention': [parsed({ type: '✨' })] }),
    );

    expect(analytics.types.map((b) => b.name)).toEqual(['✨']);
  });

  it('reports the activity of a window no convention parsed', async () => {
    const analytics = await fold(context(window));

    // Nothing judged these commits, so none of them is non-conforming.
    expect(analytics.total).toBe(3);
    expect(analytics.invalid).toBe(0);
    expect(analytics.validRate).toBe(0);
    expect(analytics.types).toEqual([]);
    expect(analytics.weeks).toHaveLength(2);
  });

  it('folds an empty history into zeroes', async () => {
    expect(await fold(context([]))).toEqual({
      total: 0,
      valid: 0,
      invalid: 0,
      validRate: 0,
      breaking: 0,
      types: [],
      scopes: [],
      weeks: [],
    });
  });
});
