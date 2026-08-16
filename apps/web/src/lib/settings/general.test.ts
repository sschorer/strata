import { describe, expect, it } from 'vitest';
import {
  checkGeneral,
  generalChanged,
  generalForm,
  NAME_MAX,
  type GeneralForm,
} from './general';

/**
 * The *General* form's pure layer: stored values in, two patches out — or the
 * reason a save cannot be sent.
 */

const project = { name: 'Strata' };

const config = {
  rev: 'HEAD',
  historyLimit: null as number | null,
};

const saved: GeneralForm = generalForm(project, config);

/** The stored form with one field edited. */
const edited = (change: Partial<GeneralForm>): GeneralForm => ({
  ...saved,
  ...change,
});

describe('generalForm', () => {
  it('takes the name from the registry and the window from the config', () => {
    expect(generalForm({ name: 'Kernel' }, { rev: 'main', historyLimit: 500 }))
      .toEqual({ name: 'Kernel', rev: 'main', historyLimit: '500' });
  });

  it('shows the whole history as an empty field', () => {
    expect(saved.historyLimit).toBe('');
  });
});

describe('generalChanged', () => {
  it('is quiet until something is edited', () => {
    expect(generalChanged(saved, saved)).toBe(false);
  });

  it('does not count whitespace a save would drop as an edit', () => {
    expect(generalChanged(edited({ name: ' Strata ' }), saved)).toBe(false);
  });

  it('notices each field', () => {
    expect(generalChanged(edited({ name: 'Strata core' }), saved)).toBe(true);
    expect(generalChanged(edited({ rev: 'main' }), saved)).toBe(true);
    expect(generalChanged(edited({ historyLimit: '500' }), saved)).toBe(true);
  });
});

describe('checkGeneral', () => {
  it('sends only the half that changed', () => {
    const check = checkGeneral(edited({ name: 'Strata core' }), saved);

    expect(check).toEqual({
      ok: true,
      patch: { identity: { name: 'Strata core' }, config: null },
    });
  });

  it('sends only the fields that changed inside a half', () => {
    const check = checkGeneral(edited({ rev: 'main' }), saved);

    expect(check.ok && check.patch.config).toEqual({ rev: 'main' });
    expect(check.ok && check.patch.identity).toBeNull();
  });

  it('sends both halves when both were edited', () => {
    const check = checkGeneral(
      edited({ name: 'Kernel', historyLimit: '500' }),
      saved,
    );

    expect(check).toEqual({
      ok: true,
      patch: { identity: { name: 'Kernel' }, config: { historyLimit: 500 } },
    });
  });

  it('sends nothing when the form still says what is stored', () => {
    expect(checkGeneral(saved, saved)).toEqual({
      ok: true,
      patch: { identity: null, config: null },
    });
  });

  it('trims what it sends', () => {
    const check = checkGeneral(
      edited({ name: '  Kernel  ', rev: '  main  ' }),
      saved,
    );

    expect(check).toEqual({
      ok: true,
      patch: { identity: { name: 'Kernel' }, config: { rev: 'main' } },
    });
  });

  it('reads a blank limit as the whole history', () => {
    const stored = generalForm(project, { rev: 'HEAD', historyLimit: 500 });

    const check = checkGeneral(edited({ ...stored, historyLimit: '' }), stored);

    expect(check.ok && check.patch.config).toEqual({ historyLimit: null });
  });

  it('refuses a project with no name', () => {
    const check = checkGeneral(edited({ name: '   ' }), saved);

    expect(check.ok).toBe(false);
    expect(!check.ok && check.error).toContain('display name');
  });

  it('refuses a name the registry would not store', () => {
    const long = 'x'.repeat(NAME_MAX + 1);

    const check = checkGeneral(edited({ name: long }), saved);

    expect(check.ok).toBe(false);
  });

  it('refuses a blank revision', () => {
    const check = checkGeneral(edited({ rev: ' ' }), saved);

    expect(check.ok).toBe(false);
    expect(!check.ok && check.error).toContain('revision');
  });

  it('refuses a limit that is not a whole number of commits', () => {
    for (const historyLimit of ['0', '-5', '1.5', 'many', '1e3']) {
      expect(checkGeneral(edited({ historyLimit }), saved).ok).toBe(false);
    }
  });
});
