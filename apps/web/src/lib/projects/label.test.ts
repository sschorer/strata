import { describe, expect, it } from 'vitest';
import { projectLabel } from './label';

describe('projectLabel', () => {
  it('names a repository after its folder', () => {
    expect(projectLabel('/home/dev/workspace/strata')).toBe('strata');
    expect(projectLabel('  /home/dev/workspace/strata/  ')).toBe('strata');
    expect(projectLabel('C:\\code\\strata')).toBe('strata');
  });

  it('has nothing to say about no path', () => {
    expect(projectLabel('')).toBe('');
    expect(projectLabel('   ')).toBe('');
  });

  it('keeps a bare name as it is', () => {
    expect(projectLabel('strata')).toBe('strata');
  });
});
