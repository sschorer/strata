import type { ParsedCommit, RawCommit } from '@strata/sdk';
import { describe, expect, it } from 'vitest';
import { analyseCommits } from './analyse.js';
import { bucketBy } from './buckets.js';
import { weeklyActivity } from './weeks.js';

/** A parsed commit; every field the aggregates read is named at the call site. */
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

/** A raw commit; only the date matters to the activity series. */
function raw(date: string): RawCommit {
  return {
    sha: date,
    author: 'Ada',
    authorEmail: 'ada@example.com',
    date,
    message: 'feat: something',
  };
}

describe('bucketBy', () => {
  it('counts a field, biggest first, with each bucket share', () => {
    const log = [
      parsed({ type: 'feat' }),
      parsed({ type: 'fix' }),
      parsed({ type: 'fix' }),
      parsed({ type: 'docs' }),
    ];

    expect(bucketBy(log, 'type')).toEqual([
      { name: 'fix', count: 2, share: 0.5, breaking: 0 },
      { name: 'docs', count: 1, share: 0.25, breaking: 0 },
      { name: 'feat', count: 1, share: 0.25, breaking: 0 },
    ]);
  });

  it('counts the breaking changes inside each bucket', () => {
    const log = [
      parsed({ type: 'feat', breaking: true }),
      parsed({ type: 'feat' }),
      parsed({ type: 'fix', breaking: true }),
    ];

    expect(bucketBy(log, 'type').map((b) => [b.name, b.breaking])).toEqual([
      ['feat', 1],
      ['fix', 1],
    ]);
  });

  it('groups by scope, keeping the unscoped commits as their own bucket', () => {
    const log = [
      parsed({ scope: 'core' }),
      parsed({ scope: 'core' }),
      parsed({ scope: null }),
      parsed({ scope: null }),
      parsed({ scope: 'web' }),
    ];

    // `null` sorts last of its size: "no scope" is the residue of the list.
    expect(bucketBy(log, 'scope').map((b) => b.name)).toEqual([
      'core',
      null,
      'web',
    ]);
  });

  it('keeps a commit the convention did not recognise, under no name', () => {
    const log = [parsed({ type: null, valid: false }), parsed({ type: 'fix' })];

    // A repository where half the history is unconventional should say so,
    // and `other` stays available as a type someone actually writes.
    expect(bucketBy(log, 'type')).toContainEqual({
      name: null,
      count: 1,
      share: 0.5,
      breaking: 0,
    });
  });

  it('has nothing to say about an empty log', () => {
    expect(bucketBy([], 'type')).toEqual([]);
  });
});

describe('weeklyActivity', () => {
  it('buckets commits into Monday-started weeks, oldest first', () => {
    // 2024-03-06 is a Wednesday, 2024-03-11 the Monday after it.
    const weeks = weeklyActivity([
      raw('2024-03-06T12:00:00+00:00'),
      raw('2024-03-08T09:30:00+00:00'),
      raw('2024-03-11T08:00:00+00:00'),
    ]);

    expect(weeks).toEqual([
      { week: '2024-03-04', commits: 2 },
      { week: '2024-03-11', commits: 1 },
    ]);
  });

  it('buckets a Sunday into the week that began six days earlier', () => {
    // Sunday closes a Monday-started week rather than opening the next one.
    expect(weeklyActivity([raw('2024-03-10T23:59:00+00:00')])).toEqual([
      { week: '2024-03-04', commits: 1 },
    ]);
  });

  it('reads the offset, so a commit is dated where it happened in UTC', () => {
    // 2024-03-11T00:30+02:00 is still Sunday the 10th in UTC.
    expect(weeklyActivity([raw('2024-03-11T00:30:00+02:00')])).toEqual([
      { week: '2024-03-04', commits: 1 },
    ]);
  });

  it('emits the quiet weeks in between as zero', () => {
    const weeks = weeklyActivity([
      raw('2024-03-05T12:00:00+00:00'),
      raw('2024-03-26T12:00:00+00:00'),
    ]);

    expect(weeks).toEqual([
      { week: '2024-03-04', commits: 1 },
      { week: '2024-03-11', commits: 0 },
      { week: '2024-03-18', commits: 0 },
      { week: '2024-03-25', commits: 1 },
    ]);
  });

  it('skips a commit git gave no date for', () => {
    expect(weeklyActivity([raw(''), raw('2024-03-06T12:00:00+00:00')])).toEqual([
      { week: '2024-03-04', commits: 1 },
    ]);
  });

  it('has no series for an empty history', () => {
    expect(weeklyActivity([])).toEqual([]);
  });
});

describe('analyseCommits', () => {
  const log = [
    raw('2024-03-06T12:00:00+00:00'),
    raw('2024-03-07T12:00:00+00:00'),
    raw('2024-03-12T12:00:00+00:00'),
    raw('2024-03-13T12:00:00+00:00'),
  ];
  const window = [
    parsed({ type: 'feat', scope: 'core' }),
    parsed({ type: 'feat', scope: 'web', breaking: true }),
    parsed({ type: 'fix', scope: 'core' }),
    parsed({ type: null, scope: null, valid: false }),
  ];

  it('reports the window, its conformance and its breaking changes', () => {
    const analytics = analyseCommits(log, window);

    expect(analytics.total).toBe(4);
    expect(analytics.valid).toBe(3);
    expect(analytics.invalid).toBe(1);
    expect(analytics.validRate).toBe(0.75);
    expect(analytics.breaking).toBe(1);
  });

  it('breaks the window down by type and by scope', () => {
    const analytics = analyseCommits(log, window);

    expect(analytics.types.map((b) => [b.name, b.count])).toEqual([
      ['feat', 2],
      ['fix', 1],
      [null, 1],
    ]);
    expect(analytics.scopes.map((b) => [b.name, b.count])).toEqual([
      ['core', 2],
      ['web', 1],
      [null, 1],
    ]);
  });

  it('carries the weekly activity series', () => {
    expect(analyseCommits(log, window).weeks).toEqual([
      { week: '2024-03-04', commits: 2 },
      { week: '2024-03-11', commits: 2 },
    ]);
  });

  it('reports activity for a window no convention parsed', () => {
    const analytics = analyseCommits(log, []);

    // No plugin judged these commits, so none of them is non-conforming —
    // an unparsed history says nothing about conformance either way.
    expect(analytics.total).toBe(4);
    expect(analytics.invalid).toBe(0);
    expect(analytics.validRate).toBe(0);
    expect(analytics.types).toEqual([]);
    expect(analytics.weeks).toHaveLength(2);
  });

  it('folds an empty history into zeroes rather than a division by zero', () => {
    expect(analyseCommits([], [])).toEqual({
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
