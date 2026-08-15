import { describe, expect, it } from 'vitest';
import { graphOf } from '$lib/test/graph';
import { focusGraph, neighbourhood } from './focus';

describe('focusGraph', () => {
  it('draws the whole graph when it fits', () => {
    const graph = graphOf('a>b b>c');
    const focused = focusGraph(graph, 10);

    expect(focused.nodes).toHaveLength(3);
    expect(focused.hidden).toBe(0);
  });

  it('keeps the cycle before the busier node outside it', () => {
    // `hub` carries the most edges, but `a` and `b` are the finding.
    const graph = graphOf('a>b b>a hub>x hub>y hub>z', [['a', 'b']]);
    const focused = focusGraph(graph, 3);

    expect(focused.nodes.map((node) => node.id).sort()).toEqual([
      'a',
      'b',
      'hub',
    ]);
    expect(focused.hidden).toBe(3);
  });

  it('drops the edges and cycles whose ends it dropped', () => {
    const graph = graphOf('a>b b>a hub>x hub>y hub>z', [['a', 'b']]);
    const focused = focusGraph(graph, 2);

    expect(focused.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(focused.edges).toHaveLength(2);
    expect(focused.cycles).toEqual([['a', 'b']]);
  });
});

describe('neighbourhood', () => {
  it('is the node and everything one edge away, either way round', () => {
    const graph = graphOf('a>b c>b b>d e>f');

    expect([...neighbourhood(graph.edges, 'b')].sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });
});
