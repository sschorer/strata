import type { GraphNode } from '@strata/sdk';
import { describe, expect, it } from 'vitest';
import { graphOf } from '$lib/test/graph';
import { layeredLayout, type Box } from './layered';

const overlap = (a: Box, b: Box) =>
  a.x + a.width > b.x + 1e-6 &&
  b.x + b.width > a.x + 1e-6 &&
  a.y + a.height > b.y + 1e-6 &&
  b.y + b.height > a.y + 1e-6;

const holds = (outer: Box, inner: Box) =>
  inner.x >= outer.x - 1e-6 &&
  inner.y >= outer.y - 1e-6 &&
  inner.x + inner.width <= outer.x + outer.width + 1e-6 &&
  inner.y + inner.height <= outer.y + outer.height + 1e-6;

describe('layeredLayout', () => {
  const graph = graphOf('a/one.ts>a/two.ts a/two.ts>b/three.ts');
  const laid = () => layeredLayout(graph.nodes, graph.edges);

  it('gives every node a card of the same size', () => {
    const { cards } = laid();
    const sizes = new Set(
      [...cards.values()].map((card) => `${card.width}×${card.height}`),
    );

    expect(cards.size).toBe(3);
    expect(sizes.size).toBe(1);
  });

  it('never overlaps two cards', () => {
    const boxes = [...laid().cards.values()];

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
      }
    }
  });

  it('puts what a card imports below it', () => {
    const { cards } = laid();

    expect(cards.get('a/one.ts')!.y).toBeLessThan(cards.get('a/two.ts')!.y);
    expect(cards.get('a/two.ts')!.y).toBeLessThan(cards.get('b/three.ts')!.y);
  });

  it('draws a container per open folder, holding its cards', () => {
    const { cards, groups } = layeredLayout(graph.nodes, graph.edges, {
      open: new Set(['a', 'b']),
    });

    expect(groups.map((group) => group.path).sort()).toEqual(['a', 'b']);
    for (const group of groups) {
      for (const [id, card] of cards) {
        if (id.startsWith(`${group.path}/`)) {
          expect(holds(group, card)).toBe(true);
        }
      }
    }
  });

  it('never overlaps two containers', () => {
    const { groups } = layeredLayout(graph.nodes, graph.edges, {
      open: new Set(['a', 'b']),
    });

    expect(overlap(groups[0]!, groups[1]!)).toBe(false);
  });

  it('keeps a container to one place in the flow, not across every rank', () => {
    // A chain three ranks deep, with one of its ends in an open folder.
    const chain = graphOf('a/one.ts>b/two.ts b/two.ts>c/three.ts');
    const { cards, groups, world } = layeredLayout(chain.nodes, chain.edges, {
      open: new Set(['a']),
    });

    const group = groups.find((one) => one.path === 'a')!;
    expect(group.height).toBeLessThan(world.height / 2);
    expect(holds(group, cards.get('a/one.ts')!)).toBe(true);
  });

  it('nests a folder opened inside another inside its container', () => {
    const nested = graphOf('a/b/one.ts>a/two.ts');
    const { groups } = layeredLayout(nested.nodes, nested.edges, {
      open: new Set(['a', 'a/b']),
    });

    const outer = groups.find((group) => group.path === 'a')!;
    const inner = groups.find((group) => group.path === 'a/b')!;
    expect(outer.depth).toBe(1);
    expect(inner.depth).toBe(2);
    expect(holds(outer, inner)).toBe(true);
  });

  it('wraps a pile of unrelated cards into a block, not a ribbon', () => {
    const many: GraphNode[] = Array.from({ length: 40 }, (_, index) => ({
      id: `f${index}.ts`,
      label: `f${index}.ts`,
      kind: 'file',
    }));
    const { world, cards } = layeredLayout(many, []);

    // 40 cards nothing depends on would otherwise be one line off the side.
    expect(world.width).toBeLessThan(40 * 176);
    for (const card of cards.values()) {
      expect(card.x + card.width).toBeLessThanOrEqual(world.width);
      expect(card.y + card.height).toBeLessThanOrEqual(world.height);
    }
  });

  it('is pure: the same graph lands in the same place twice', () => {
    expect([...laid().cards]).toEqual([...laid().cards]);
  });

  it('returns nothing for an empty graph', () => {
    const empty = layeredLayout([], []);
    expect(empty.cards.size).toBe(0);
    expect(empty.groups).toEqual([]);
  });
});
