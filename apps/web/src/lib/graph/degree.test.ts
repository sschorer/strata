import { describe, expect, it } from 'vitest';
import { graphOf } from '$lib/test/graph';
import { degrees } from './degree';

describe('degrees', () => {
  it('counts imports in and out, leaves included', () => {
    const { fanIn, fanOut } = degrees(graphOf('a>c b>c c>d'));

    expect(fanIn.get('c')).toBe(2);
    expect(fanOut.get('c')).toBe(1);
    expect(fanIn.get('a')).toBe(0);
    expect(fanOut.get('d')).toBe(0);
  });
});
