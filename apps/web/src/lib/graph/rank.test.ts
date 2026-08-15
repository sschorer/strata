import { describe, expect, it } from 'vitest';
import { graphOf } from '$lib/test/graph';
import { rankNodes } from './rank';

describe('rankNodes', () => {
  it('puts what a node imports one column past it', () => {
    const graph = graphOf('a>b b>c');
    const { rank } = rankNodes(
      graph.nodes.map((node) => node.id),
      graph.edges,
    );

    expect(rank.get('a')).toBe(0);
    expect(rank.get('b')).toBe(1);
    expect(rank.get('c')).toBe(2);
  });

  it('ranks by the longest way in, so no arrow points backwards', () => {
    // `d` is reached in one step from `a` and in two through `b`.
    const graph = graphOf('a>b b>d a>d');
    const { rank } = rankNodes(
      graph.nodes.map((node) => node.id),
      graph.edges,
    );

    expect(rank.get('d')).toBe(2);
  });

  it('sets aside the edges that close a loop', () => {
    const graph = graphOf('a>b b>a');
    const { rank, reversed } = rankNodes(
      graph.nodes.map((node) => node.id),
      graph.edges,
    );

    expect(reversed.size).toBe(1);
    // Without one of them the pair still lays out left to right.
    expect(rank.get('a')).not.toBe(rank.get('b'));
  });

  it('terminates on a graph that is nothing but cycles', () => {
    const graph = graphOf('a>b b>c c>a');
    const { rank } = rankNodes(
      graph.nodes.map((node) => node.id),
      graph.edges,
    );

    expect([...rank.values()].every(Number.isFinite)).toBe(true);
  });

  it('is pure', () => {
    const graph = graphOf('a>b b>c c>a a>c');
    const ids = graph.nodes.map((node) => node.id);
    expect([...rankNodes(ids, graph.edges).rank]).toEqual([
      ...rankNodes(ids, graph.edges).rank,
    ]);
  });
});
