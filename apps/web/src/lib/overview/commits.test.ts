import { describe, expect, it } from 'vitest';
import type { ParsedCommit } from '@strata/sdk';
import { commitTotals, commitTypes } from './commits';

const commit = (
  type: string | null,
  extra: Partial<ParsedCommit> = {},
): ParsedCommit => ({
  type,
  scope: null,
  breaking: false,
  subject: 'a change',
  tags: {},
  valid: type !== null,
  ...extra,
});

const history = [
  commit('feat'),
  commit('feat'),
  commit('fix', { breaking: true }),
  commit('feat'),
  commit(null, { valid: false }),
];

describe('commitTypes', () => {
  it('groups the window by type, biggest first', () => {
    expect(commitTypes(history)).toEqual([
      { type: 'feat', count: 3, share: 0.6, breaking: 0 },
      { type: 'fix', count: 1, share: 0.2, breaking: 1 },
      { type: 'other', count: 1, share: 0.2, breaking: 0 },
    ]);
  });

  it('orders ties by name so two runs print the same list', () => {
    const tied = [commit('test'), commit('chore'), commit('docs')];

    expect(commitTypes(tied).map((row) => row.type)).toEqual([
      'chore',
      'docs',
      'test',
    ]);
  });

  it('files a commit the convention did not recognise rather than dropping it', () => {
    expect(commitTypes([commit(null, { valid: false })])).toEqual([
      { type: 'other', count: 1, share: 1, breaking: 0 },
    ]);
  });

  it('is empty for a report with no history', () => {
    expect(commitTypes([])).toEqual([]);
  });
});

describe('commitTotals', () => {
  it('counts the window, what parsed, and what breaks', () => {
    expect(commitTotals(history)).toEqual({
      total: 5,
      valid: 4,
      breaking: 1,
    });
  });

  it('is zeroes for a report with no history', () => {
    expect(commitTotals([])).toEqual({ total: 0, valid: 0, breaking: 0 });
  });
});
