import { describe, expect, it } from 'vitest';
import { graphOf } from '$lib/test/graph';
import { cycleMembership, cycleViews } from './cycles';

describe('cycleViews', () => {
  it('closes a component into a walk of real edges', () => {
    const graph = graphOf('a>b b>c c>a', [['c', 'a', 'b']]);
    const [cycle] = cycleViews(graph);

    expect(cycle!.path).toEqual(['a', 'b', 'c', 'a']);
    expect(cycle!.members).toEqual(['a', 'b', 'c']);
    expect(cycle!.index).toBe(1);
  });

  it('walks back the long way when the greedy path dead-ends', () => {
    // b and c both come off a, but only c returns to it: the greedy walk takes
    // b first (sorted), then has to find its own way home.
    const graph = graphOf('a>b b>c c>a a>c', [['a', 'b', 'c']]);
    const [cycle] = cycleViews(graph);

    const pairs = cycle!.path.slice(1).map((to, i) => `${cycle!.path[i]}>${to}`);
    for (const pair of pairs) {
      expect(graph.edges.map((e) => `${e.from}>${e.to}`)).toContain(pair);
    }
    expect(cycle!.path.at(0)).toBe(cycle!.path.at(-1));
  });

  it('handles a component of two files importing each other', () => {
    const [cycle] = cycleViews(graphOf('a>b b>a', [['b', 'a']]));
    expect(cycle!.path).toEqual(['a', 'b', 'a']);
  });

  it('lists the biggest knot first and numbers the list', () => {
    const graph = graphOf('a>b b>a c>d d>e e>c', [
      ['a', 'b'],
      ['c', 'd', 'e'],
    ]);
    const views = cycleViews(graph);

    expect(views.map((view) => view.members.length)).toEqual([3, 2]);
    expect(views.map((view) => view.index)).toEqual([1, 2]);
    expect(cycleMembership(views).get('a')).toBe(2);
    expect(cycleMembership(views).get('d')).toBe(1);
  });

  it('is empty for an acyclic graph', () => {
    expect(cycleViews(graphOf('a>b b>c', []))).toEqual([]);
  });
});
