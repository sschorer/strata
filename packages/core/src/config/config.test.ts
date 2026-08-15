import { describe, expect, it } from 'vitest';
import {
  applyPatch,
  DEFAULT_PROJECT_CONFIG,
  InvalidConfigError,
  withDefaults,
  type ProjectConfig,
} from './index.js';

/**
 * Config is stored sparsely and filled out on read, so the two halves have to
 * agree: what a patch keeps, what it replaces, and what it refuses to store at
 * all — a settings screen posting an empty row must not create a rule nobody
 * can read back.
 */

describe('withDefaults', () => {
  it('fills an empty config out to the pre-configuration behaviour', () => {
    expect(withDefaults({})).toEqual({
      rev: 'HEAD',
      historyLimit: null,
      ignore: [],
      paths: [],
      languages: null,
      metrics: null,
      convention: null,
      rules: [],
    });
  });

  it('keeps what was set and defaults the rest', () => {
    expect(withDefaults({ rev: 'main', historyLimit: 500 })).toMatchObject({
      rev: 'main',
      historyLimit: 500,
      ignore: [],
    });
  });

  it('copies out, so a caller cannot mutate the defaults', () => {
    withDefaults({}).ignore.push('**/dist/**');

    expect(DEFAULT_PROJECT_CONFIG.ignore).toEqual([]);
  });
});

describe('applyPatch', () => {
  const stored: Partial<ProjectConfig> = {
    rev: 'main',
    ignore: ['**/dist/**'],
  };

  it('merges by field and leaves the rest alone', () => {
    expect(applyPatch(stored, { historyLimit: 500 })).toEqual({
      rev: 'main',
      ignore: ['**/dist/**'],
      historyLimit: 500,
    });
  });

  it('replaces an array whole rather than adding to it', () => {
    expect(applyPatch(stored, { ignore: ['**/*.lock'] })).toMatchObject({
      ignore: ['**/*.lock'],
    });
  });

  it('trims, drops blank entries and collapses duplicates', () => {
    expect(
      applyPatch({}, { ignore: [' **/dist/** ', '', '  ', '**/dist/**'] }),
    ).toEqual({ ignore: ['**/dist/**'] });
  });

  it('takes null for "no cap" and "every registered plugin"', () => {
    expect(
      applyPatch(
        { historyLimit: 500, languages: ['strata-language-typescript'] },
        { historyLimit: null, languages: null, convention: null },
      ),
    ).toEqual({ historyLimit: null, languages: null, convention: null });
  });

  it('keeps rules, defaulting a new one to report-only', () => {
    const patched = applyPatch(
      {},
      {
        rules: [
          { from: ' src/ui/** ', to: 'src/db/**', enforced: true },
          { from: 'src/api/**', to: 'src/ui/**' } as never,
        ],
      },
    );

    expect(patched.rules).toEqual([
      { from: 'src/ui/**', to: 'src/db/**', enforced: true },
      { from: 'src/api/**', to: 'src/ui/**', enforced: false },
    ]);
  });

  it('refuses a value that cannot mean anything', () => {
    expect(() => applyPatch({}, { rev: '   ' })).toThrow(InvalidConfigError);
    expect(() => applyPatch({}, { historyLimit: 0 })).toThrow(
      InvalidConfigError,
    );
    expect(() => applyPatch({}, { historyLimit: 2.5 })).toThrow(
      InvalidConfigError,
    );
    expect(() => applyPatch({}, { languages: [' '] })).toThrow(
      InvalidConfigError,
    );
    expect(() =>
      applyPatch({}, { rules: [{ from: 'src/**', to: '', enforced: true }] }),
    ).toThrow(InvalidConfigError);
  });

  it('does not touch what it was given', () => {
    const before = { ...stored };

    applyPatch(stored, { rev: 'develop' });

    expect(stored).toEqual(before);
  });
});
