import { describe, expect, it } from 'vitest';
import { troubleLine, troubleVerb } from './phrase';
import type { StageTrouble } from './trouble';

const failed: StageTrouble = {
  id: 'acme-language-python',
  status: 'failed',
  reason: 'parser exploded',
};
const skipped: StageTrouble = {
  id: 'acme-language-go',
  status: 'skipped',
  reason: 'its filter matched no file at this revision',
};

describe('troubleVerb', () => {
  it('says what happened to one stage', () => {
    expect(troubleVerb(failed)).toBe('failed');
    expect(troubleVerb(skipped)).toBe('did not run');
  });
});

describe('troubleLine', () => {
  it('is nothing at all when nothing went wrong', () => {
    expect(troubleLine([])).toBe('');
  });

  it('counts stages that ended the same way, in their own words', () => {
    expect(troubleLine([failed])).toBe('1 stage failed');
    expect(troubleLine([failed, { ...failed, id: 'other' }])).toBe(
      '2 stages failed',
    );
    expect(troubleLine([skipped])).toBe('1 stage did not run');
  });

  it('says only that a mixed set did not report', () => {
    // Two different things happened; a hint has room for the count, and the
    // reasons are printed where the output would have been.
    expect(troubleLine([failed, skipped])).toBe('2 stages did not report');
  });
});
