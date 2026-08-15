import { describe, expect, it } from 'vitest';
import { compactNumber } from './number';

describe('compactNumber', () => {
  it('rounds small values and abbreviates large ones', () => {
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(12.4)).toBe('12');
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(1240)).toBe('1.2k');
    expect(compactNumber(12_400)).toBe('12k');
    expect(compactNumber(3_400_000)).toBe('3.4M');
    expect(compactNumber(2_000_000_000)).toBe('2.0B');
  });

  it('marks a value it cannot show', () => {
    expect(compactNumber(Number.NaN)).toBe('—');
  });
});
