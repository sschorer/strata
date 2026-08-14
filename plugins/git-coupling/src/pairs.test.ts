import { describe, expect, it } from 'vitest';
import { countCoChanges, pairKey, splitPair } from './pairs.js';

describe('countCoChanges', () => {
  it('counts changes per file and per pair', () => {
    const { changes, shared } = countCoChanges(
      [
        ['a.ts', 'b.ts'],
        ['a.ts', 'b.ts', 'c.ts'],
        ['a.ts'],
      ],
      30,
    );

    expect(changes.get('a.ts')).toBe(3);
    expect(changes.get('b.ts')).toBe(2);
    expect(changes.get('c.ts')).toBe(1);
    expect(shared.get(pairKey('a.ts', 'b.ts'))).toBe(2);
    expect(shared.get(pairKey('b.ts', 'c.ts'))).toBe(1);
    expect(shared.get(pairKey('a.ts', 'd.ts'))).toBeUndefined();
  });

  it('skips commits that touch more files than the cap', () => {
    const sweep = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
    const { changes, shared } = countCoChanges([['a.ts', 'b.ts'], sweep], 3);

    expect(changes.get('a.ts')).toBe(1);
    expect(changes.get('d.ts')).toBeUndefined();
    expect(shared.get(pairKey('a.ts', 'b.ts'))).toBe(1);
    expect(shared.get(pairKey('c.ts', 'd.ts'))).toBeUndefined();
  });

  it('keys a pair the same way whichever order it is seen in', () => {
    expect(pairKey('a.ts', 'b.ts')).toBe(pairKey('b.ts', 'a.ts'));
    expect(splitPair(pairKey('b.ts', 'a.ts'))).toEqual(['a.ts', 'b.ts']);
  });
});
