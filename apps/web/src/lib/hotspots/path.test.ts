import { describe, expect, it } from 'vitest';
import { dirName, fileName } from './path';

describe('path', () => {
  it('splits a repo path into directory and name', () => {
    expect(dirName('packages/core/src/strata.ts')).toBe('packages/core/src/');
    expect(fileName('packages/core/src/strata.ts')).toBe('strata.ts');
  });

  it('treats a root-level file as having no directory', () => {
    expect(dirName('README.md')).toBe('');
    expect(fileName('README.md')).toBe('README.md');
  });
});
