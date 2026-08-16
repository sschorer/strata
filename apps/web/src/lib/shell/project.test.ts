import { describe, expect, it } from 'vitest';
import { projectLabel } from './project';

describe('projectLabel', () => {
  it('names a project after its folder', () => {
    expect(projectLabel('/home/dev/workspace/strata')).toBe('strata');
    expect(projectLabel('  /home/dev/workspace/strata/  ')).toBe('strata');
    expect(projectLabel('C:\\code\\strata')).toBe('strata');
  });

  it('is empty when no repository has been named', () => {
    expect(projectLabel('')).toBe('');
    expect(projectLabel('   ')).toBe('');
  });

  it('keeps a bare name as it is', () => {
    expect(projectLabel('strata')).toBe('strata');
  });
});
