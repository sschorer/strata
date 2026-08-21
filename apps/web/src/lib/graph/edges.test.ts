import { describe, expect, it } from 'vitest';
import { cyclesOf, graphOf } from '$lib/test/graph';
import { cycleMembership } from './membership';
import { classifyEdges, edgeDash, edgeKey, edgeStroke } from './edges';

describe('classifyEdges', () => {
  const graph = graphOf('a>b b>a b>c', [['a', 'b']]);
  const cycleOf = cycleMembership(cyclesOf(graph.cycles));
  const classes = classifyEdges(graph, cycleOf);

  const classOf = (from: string, to: string) =>
    classes.get(edgeKey({ from, to, kind: 'import' }));

  it('marks an edge whose ends share a component as a cycle edge', () => {
    expect(classOf('a', 'b')).toBe('cycle');
    expect(classOf('b', 'a')).toBe('cycle');
  });

  it('leaves an edge out of the knot local', () => {
    expect(classOf('b', 'c')).toBe('local');
  });

  it('marks an edge onto a package node as a package edge', () => {
    const withPackage = {
      nodes: [
        { id: 'a', label: 'a', kind: 'file' as const },
        { id: 'svelte', label: 'svelte', kind: 'package' as const },
      ],
      edges: [{ from: 'a', to: 'svelte', kind: 'import' as const }],
      cycles: [],
    };

    expect(
      classifyEdges(withPackage, new Map()).get(
        edgeKey(withPackage.edges[0]!),
      ),
    ).toBe('package');
  });
});

describe('edge styling', () => {
  it('gives each class its own stroke, and dashes only the package one', () => {
    const strokes = new Set(
      (['local', 'package', 'cycle'] as const).map(edgeStroke),
    );

    expect(strokes.size).toBe(3);
    expect(edgeDash('package')).not.toBe('none');
    expect(edgeDash('local')).toBe('none');
    expect(edgeDash('cycle')).toBe('none');
  });
});
