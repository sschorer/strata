import { describe, expect, it } from 'vitest';
import { graphOf } from '$lib/test/graph';
import { graphSummary } from './summary';

describe('graphSummary', () => {
  it('counts the graph and names its busiest node', () => {
    const summary = graphSummary(
      graphOf('a>c b>c c>a c>d', [['a', 'c']]),
    );

    expect(summary.nodes).toBe(4);
    expect(summary.edges).toBe(4);
    expect(summary.cycles).toBe(1);
    expect(summary.cycleNodes).toBe(2);
    expect(summary.maxFanIn).toEqual({ id: 'c', count: 2 });
    expect(summary.maxFanOut).toEqual({ id: 'c', count: 2 });
  });

  it('names nobody when nothing imports anything', () => {
    const summary = graphSummary({
      nodes: [{ id: 'a', label: 'a', kind: 'file' }],
      edges: [],
      cycles: [],
    });

    expect(summary.maxFanIn).toBeNull();
    expect(summary.maxFanOut).toBeNull();
  });
});
