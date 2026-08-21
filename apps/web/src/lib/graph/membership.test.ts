import type { GraphCycle } from '@strata/sdk';
import { describe, expect, it } from 'vitest';
import { cycleMembership } from './membership';

const cycles: GraphCycle[] = [
  { nodes: ['c', 'd', 'e'], path: ['c', 'd', 'e', 'c'] },
  { nodes: ['a', 'b'], path: ['a', 'b', 'a'] },
];

describe('cycleMembership', () => {
  it('numbers a node by the cycle it sits in, as the list prints them', () => {
    const membership = cycleMembership(cycles);

    expect(membership.get('d')).toBe(1);
    expect(membership.get('a')).toBe(2);
  });

  it('leaves a node outside every knot unnumbered', () => {
    expect(cycleMembership(cycles).get('z')).toBeUndefined();
  });

  it('is empty for an acyclic graph', () => {
    expect(cycleMembership([]).size).toBe(0);
  });
});
