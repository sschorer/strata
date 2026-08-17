import { describe, expect, it } from 'vitest';
import { sameToken } from './compare.js';
import { configuredToken } from './token.js';
import { authWarning } from './warning.js';

/**
 * Reading the deployment's credential, and what is said about it at startup.
 * The awkward cases are the ones where a deployment *looks* configured: an
 * empty variable, or a token left at a placeholder.
 */

describe('configuredToken', () => {
  it('is the variable, without the whitespace an .env file brings', () => {
    expect(configuredToken('  s3cret  ')).toBe('s3cret');
  });

  it('is undefined when the variable is unset, empty or blank', () => {
    expect(configuredToken(undefined)).toBeUndefined();
    expect(configuredToken('')).toBeUndefined();
    expect(configuredToken('   ')).toBeUndefined();
  });

  it('reads the environment when nothing is passed', () => {
    const previous = process.env.STRATA_TOKEN;
    process.env.STRATA_TOKEN = 'from-the-environment';
    try {
      expect(configuredToken()).toBe('from-the-environment');
    } finally {
      if (previous === undefined) delete process.env.STRATA_TOKEN;
      else process.env.STRATA_TOKEN = previous;
    }
  });
});

describe('sameToken', () => {
  it('holds for the same secret and nothing else', () => {
    expect(sameToken('s3cret', 's3cret')).toBe(true);
    expect(sameToken('s3cret', 's3crey')).toBe(false);
    // Length is not a shortcut out: a prefix and a superset both compare.
    expect(sameToken('s3cre', 's3cret')).toBe(false);
    expect(sameToken('s3crets', 's3cret')).toBe(false);
    expect(sameToken('', 's3cret')).toBe(false);
  });

  it('compares bytes, not normalised text', () => {
    expect(sameToken('S3CRET', 's3cret')).toBe(false);
    expect(sameToken('s3cret ', 's3cret')).toBe(false);
  });
});

describe('authWarning', () => {
  it('says an unauthenticated API out loud', () => {
    expect(authWarning(undefined)).toContain('unauthenticated');
  });

  it('says a token short enough to guess', () => {
    expect(authWarning('hunter2')).toContain('guess');
  });

  it('has nothing to say about a real one', () => {
    expect(authWarning('0123456789abcdef')).toBeUndefined();
  });
});
