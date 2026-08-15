import { describe, expect, it } from 'vitest';
import { projectId } from './id.js';

const free = () => false;

/**
 * The id is what `/projects/:id` and stored config point at, so it is assigned
 * once: it has to be URL-safe whatever someone types as a display name, and it
 * has to be unique even when two projects are called the same thing.
 */
describe('projectId', () => {
  it('slugs a display name', () => {
    expect(projectId('Strata', free)).toBe('strata');
    expect(projectId('My Repo — 2026!', free)).toBe('my-repo-2026');
    expect(projectId('  spaced  out  ', free)).toBe('spaced-out');
  });

  it('folds accents rather than dropping the letter', () => {
    expect(projectId('Ökonomie', free)).toBe('okonomie');
  });

  it('falls back when a name slugs to nothing', () => {
    expect(projectId('***', free)).toBe('project');
    expect(projectId('', free)).toBe('project');
  });

  it('caps the length without leaving a trailing dash', () => {
    const id = projectId(`${'a'.repeat(47)} tail`, free);

    expect(id).toBe('a'.repeat(47));
    expect(id.length).toBeLessThanOrEqual(48);
  });

  it('suffixes until the id is free', () => {
    const taken = new Set(['strata', 'strata-2']);

    expect(projectId('Strata', (id) => taken.has(id))).toBe('strata-3');
  });
});
